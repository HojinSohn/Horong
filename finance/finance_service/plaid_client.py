"""Thin wrapper around plaid-python, isolating the rest of the service
from Plaid's generated SDK shapes."""
from __future__ import annotations

import json
from dataclasses import dataclass, field

import plaid
from plaid.api import plaid_api
from plaid.exceptions import ApiException
from plaid.model.country_code import CountryCode
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.transactions_sync_request import TransactionsSyncRequest

CLIENT_USER_ID = "horong-dashboard-user"  # single-user app, fixed id
REQUEST_TIMEOUT_SECONDS = 10  # bound how long a hung Plaid connection can block a worker thread


class ItemLoginRequiredError(Exception):
    """Plaid reports the linked item needs the user to re-authenticate
    (expired/changed bank credentials)."""


@dataclass
class SyncResult:
    added: list[dict] = field(default_factory=list)
    modified: list[dict] = field(default_factory=list)
    removed_ids: list[str] = field(default_factory=list)
    next_cursor: str = ""


def _environment_host(environment: str) -> str:
    return plaid.Environment.Sandbox if environment == "sandbox" else plaid.Environment.Production


class PlaidClient:
    def __init__(self, client_id: str, secret: str, environment: str) -> None:
        configuration = plaid.Configuration(
            host=_environment_host(environment),
            api_key={"clientId": client_id, "secret": secret},
        )
        self._api = plaid_api.PlaidApi(plaid.ApiClient(configuration))

    def create_link_token(self) -> str:
        request = LinkTokenCreateRequest(
            client_name="Horong Dashboard",
            language="en",
            country_codes=[CountryCode("US")],
            user=LinkTokenCreateRequestUser(client_user_id=CLIENT_USER_ID),
            products=[Products("transactions")],
        )
        response = self._api.link_token_create(request, _request_timeout=REQUEST_TIMEOUT_SECONDS)
        return response.link_token

    def exchange_public_token(self, public_token: str) -> tuple[str, str]:
        request = ItemPublicTokenExchangeRequest(public_token=public_token)
        response = self._api.item_public_token_exchange(request, _request_timeout=REQUEST_TIMEOUT_SECONDS)
        return response.access_token, response.item_id

    def sync_transactions(self, access_token: str, cursor: str | None) -> SyncResult:
        result = SyncResult(next_cursor=cursor or "")
        has_more = True
        while has_more:
            request_kwargs = {"access_token": access_token}
            if result.next_cursor:
                request_kwargs["cursor"] = result.next_cursor
            request = TransactionsSyncRequest(**request_kwargs)
            try:
                response = self._api.transactions_sync(request, _request_timeout=REQUEST_TIMEOUT_SECONDS)
            except ApiException as exc:
                if _plaid_error_code(exc) == "ITEM_LOGIN_REQUIRED":
                    raise ItemLoginRequiredError from exc
                raise
            result.added.extend(_simplify(t) for t in response.added)
            result.modified.extend(_simplify(t) for t in response.modified)
            result.removed_ids.extend(t.transaction_id for t in response.removed)
            result.next_cursor = response.next_cursor
            has_more = response.has_more
        return result


def _plaid_error_code(exc: ApiException) -> str | None:
    body = exc.body
    if body is None:
        return None
    if isinstance(body, bytes):
        body = body.decode()
    try:
        return json.loads(body).get("error_code")
    except (ValueError, AttributeError):
        return None


def _simplify(transaction) -> dict:
    return {
        "transaction_id": transaction.transaction_id,
        "date": str(transaction.date),
        "name": transaction.name,
        "amount": transaction.amount,
        "category": transaction.category[0] if transaction.category else None,
        "pending": transaction.pending,
    }

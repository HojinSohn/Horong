"""Dev convenience: mint a Plaid Sandbox public_token for a fake test
institution, without needing the browser Link UI. Requires PLAID_CLIENT_ID
and PLAID_SECRET (Sandbox keys) in the environment. Prints the public_token
so it can be piped into a curl call against /link/exchange."""
from __future__ import annotations

import os

import plaid
from plaid.api import plaid_api
from plaid.model.products import Products
from plaid.model.sandbox_public_token_create_request import SandboxPublicTokenCreateRequest

FIRST_PLATYPUS_BANK = "ins_109508"  # Plaid's well-known Sandbox test institution


def main() -> None:
    configuration = plaid.Configuration(
        host=plaid.Environment.Sandbox,
        api_key={"clientId": os.environ["PLAID_CLIENT_ID"], "secret": os.environ["PLAID_SECRET"]},
    )
    api = plaid_api.PlaidApi(plaid.ApiClient(configuration))
    request = SandboxPublicTokenCreateRequest(
        institution_id=FIRST_PLATYPUS_BANK,
        initial_products=[Products("transactions")],
    )
    response = api.sandbox_public_token_create(request)
    print(response.public_token)


if __name__ == "__main__":
    main()

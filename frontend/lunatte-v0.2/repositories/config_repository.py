from __future__ import annotations

from server_config import config_path, find_vault_root
from server_storage import read_json_dict, read_secrets, write_json_dict, write_secrets


def read_config_file() -> dict:
    return read_json_dict(config_path())


def write_config_file(config: dict) -> None:
    write_json_dict(config_path(), config)


def config_relative_path() -> str:
    return str(config_path().relative_to(find_vault_root()))


def read_secret_store() -> dict:
    return read_secrets()


def write_secret_store(secrets: dict) -> None:
    write_secrets(secrets)


"""Geologist model API backed by the installed native employee adapter."""

from shaleyeah_employee.models import (
    ConfiguredModel,
    ModelProviderError,
    ReferenceConfig,
    begin_model_budget,
    enforce_model_budget,
    native_adapter,
    parse_model_profile,
    parse_reference_config,
    public_profile,
    read_private_config,
    resolve_file_credential,
)

__all__ = [
    "ConfiguredModel",
    "ModelProviderError",
    "ReferenceConfig",
    "begin_model_budget",
    "enforce_model_budget",
    "native_adapter",
    "parse_model_profile",
    "parse_reference_config",
    "public_profile",
    "read_private_config",
    "resolve_file_credential",
]

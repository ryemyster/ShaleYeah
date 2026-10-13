"""Geologist context API backed by the installed employee runtime helper."""

from shaleyeah_employee.context import ContextCatalog, ContextError, _guard, canonical, private_file

__all__ = ["ContextCatalog", "ContextError", "_guard", "canonical", "private_file"]

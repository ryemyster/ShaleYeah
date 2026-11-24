"""Geologist event facade using the shared employee metadata hooks."""

from shaleyeah_employee.events import EmployeeEvents as GeologistEvents
from shaleyeah_employee.events import VerifiedReview

__all__ = ["GeologistEvents", "VerifiedReview"]

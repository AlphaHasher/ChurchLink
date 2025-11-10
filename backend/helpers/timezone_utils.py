"""
Timezone utilities for consistent date/time handling across the application.

This module provides utilities to ensure all date/time operations use the church's
local timezone (configured via LOCAL_TIMEZONE environment variable) rather than UTC.
This prevents timezone-related bugs where dates selected by users in their local
timezone are misinterpreted as UTC dates.

IMPORTANT: When normalizing dates (like publish_date or display_week), we extract
only the DATE PORTION and ignore the time/timezone. This prevents date shifting
when converting between timezones (e.g., "2025-11-10" should always become
"2025-11-10 midnight local", not shift to "2025-11-09" or "2025-11-11").
"""

import os
import pytz
from datetime import datetime, time, timedelta
from typing import Optional


def get_local_timezone() -> pytz.BaseTzInfo:
	"""
	Get the church's local timezone from environment configuration.
	
	Returns:
		pytz timezone object for the configured LOCAL_TIMEZONE,
		defaults to 'America/Los_Angeles' if not configured or invalid
	"""
	timezone_name = os.getenv('LOCAL_TIMEZONE', 'America/Los_Angeles')
	try:
		return pytz.timezone(timezone_name)
	except pytz.UnknownTimeZoneError:
		print(f"Warning: Unknown timezone '{timezone_name}', falling back to America/Los_Angeles")
		return pytz.timezone('America/Los_Angeles')


def get_local_now() -> datetime:
	"""
	Get current time in the church's local timezone.
	
	Returns:
		Timezone-aware datetime object representing current time in local timezone
	"""
	local_tz = get_local_timezone()
	return datetime.now(local_tz)


def normalize_to_local_midnight(dt: datetime) -> datetime:
	"""
	Normalize a datetime to midnight (00:00:00) in the church's local timezone.
	
	CRITICAL: This function extracts ONLY the date portion (year, month, day)
	and creates a new datetime at midnight in the local timezone, ignoring
	the original timezone. This prevents date shifting when converting between
	timezones (e.g., UTC 2025-11-10 should become Local 2025-11-10, not 2025-11-09).
	
	Args:
		dt: datetime to normalize (can be naive or timezone-aware)
	
	Returns:
		Timezone-aware datetime at midnight in local timezone
	"""
	local_tz = get_local_timezone()
	
	# Extract ONLY the date portion (year, month, day), ignoring time and timezone
	# This is crucial: we want "2025-11-10" in any timezone to become
	# "2025-11-10 00:00:00" in local timezone, NOT shift to a different date
	date_only = dt.date()
	
	# Create a naive datetime at midnight with that date
	naive_midnight = datetime.combine(date_only, time(0, 0, 0))
	
	# Localize to local timezone (making it timezone-aware)
	local_midnight = local_tz.localize(naive_midnight)
	
	return local_midnight


def normalize_to_local_week_start(dt: datetime) -> datetime:
	"""
	Normalize datetime to Monday 00:00:00 in the church's local timezone.
	
	CRITICAL: Extracts date portion first to avoid date shifting when converting
	between timezones. The week start is calculated based on the date value,
	not on the timezone-converted date.
	
	Args:
		dt: datetime to normalize (can be naive or timezone-aware)
	
	Returns:
		Timezone-aware datetime at Monday midnight in local timezone
	"""
	local_tz = get_local_timezone()
	
	# Extract date portion first (to avoid timezone shift changing the date)
	date_only = dt.date()
	
	# Find Monday (weekday 0) of the week containing this date
	days_since_monday = date_only.weekday()
	monday_date = date_only - timedelta(days=days_since_monday)
	
	# Create naive datetime at midnight on Monday
	monday_naive = datetime.combine(monday_date, time(0, 0, 0))
	
	# Localize to local timezone
	monday_midnight = local_tz.localize(monday_naive)
	
	return monday_midnight


def convert_naive_to_local(dt: Optional[datetime]) -> Optional[datetime]:
	"""
	Convert a naive datetime to timezone-aware datetime in local timezone.
	
	If the datetime is already timezone-aware, convert it to local timezone.
	If None is provided, returns None.
	
	Args:
		dt: datetime to convert (naive or timezone-aware) or None
	
	Returns:
		Timezone-aware datetime in local timezone, or None
	"""
	if dt is None:
		return None
	
	local_tz = get_local_timezone()
	
	if dt.tzinfo is None:
		# Naive datetime - assume local timezone
		return local_tz.localize(dt)
	else:
		# Already has timezone - convert to local
		return dt.astimezone(local_tz)


def convert_to_utc_for_storage(dt: datetime) -> datetime:
	"""
	Convert a datetime to UTC for database storage.
	
	MongoDB stores dates as UTC, so we need to convert local times
	to UTC before storing. This ensures consistency in the database.
	
	Args:
		dt: timezone-aware datetime in any timezone
	
	Returns:
		Timezone-aware datetime in UTC
	"""
	if dt.tzinfo is None:
		# If naive, assume it's local timezone first
		local_tz = get_local_timezone()
		dt = local_tz.localize(dt)
	
	return dt.astimezone(pytz.UTC)


def strip_timezone_for_mongo(dt: datetime) -> datetime:
	"""
	Strip timezone info from datetime for MongoDB storage.
	
	MongoDB stores all datetimes as UTC but without timezone info.
	This function converts to UTC and removes tzinfo for storage.
	
	Args:
		dt: datetime (naive or timezone-aware)
	
	Returns:
		Naive datetime in UTC
	"""
	if dt.tzinfo is None:
		# If naive, assume local timezone
		local_tz = get_local_timezone()
		dt = local_tz.localize(dt)
	
	# Convert to UTC and remove timezone info
	utc_dt = dt.astimezone(pytz.UTC)
	return utc_dt.replace(tzinfo=None)

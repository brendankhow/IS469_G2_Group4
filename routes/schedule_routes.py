"""
Schedule parsing routes for AI-powered interview scheduling.

This module provides endpoints for parsing natural language scheduling requests
into structured date/time slots.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict
from datetime import datetime, timedelta
import re

router = APIRouter()

class ScheduleRequest(BaseModel):
    message: str
    current_date: str

class ScheduleSlot(BaseModel):
    date: str  # ISO format YYYY-MM-DD
    time: str  # HH:MM format

class ScheduleResponse(BaseModel):
    slots: List[Dict[str, str]]
    ai_message: str

@router.post("/parse_schedule", response_model=ScheduleResponse)
async def parse_schedule(request: ScheduleRequest):
    """
    Parse natural language scheduling request into structured date/time slots.
    
    Example inputs:
    - "schedule on Monday and Tuesday at 9am"
    - "I want to meet on Dec 5th at 2pm and Dec 6th at 3pm"
    - "next Monday at 10:30am and Wednesday at 2pm"
    """
    try:
        message = request.message.lower()
        current_date = datetime.fromisoformat(request.current_date.replace('Z', '+00:00'))
        
        # Parse the message to extract dates and times
        slots = parse_scheduling_message(message, current_date)
        
        if not slots:
            return ScheduleResponse(
                slots=[],
                ai_message="I couldn't understand the scheduling request. Please specify dates and times clearly (e.g., 'Monday and Tuesday at 9am')."
            )
        
        # Format response message
        slot_descriptions = []
        for slot in slots:
            date_obj = datetime.fromisoformat(slot['date'])
            slot_descriptions.append(
                f"{date_obj.strftime('%A, %B %d')} at {slot['time']}"
            )
        
        ai_message = f"I've scheduled interview slots for {' and '.join(slot_descriptions)}. An email has been sent to the candidate with these options."
        
        return ScheduleResponse(
            slots=slots,
            ai_message=ai_message
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse schedule: {str(e)}")


def parse_scheduling_message(message: str, current_date: datetime) -> List[Dict[str, str]]:
    """
    Parse natural language message to extract date/time slots.
    
    This is a simplified parser. For production, you'd want to use
    a more sophisticated NLP approach or LLM-based parsing.
    """
    slots = []
    
    # Define day name mappings
    day_names = {
        'monday': 0, 'mon': 0,
        'tuesday': 1, 'tue': 1, 'tues': 1,
        'wednesday': 2, 'wed': 2,
        'thursday': 3, 'thu': 3, 'thur': 3, 'thurs': 3,
        'friday': 4, 'fri': 4,
        'saturday': 5, 'sat': 5,
        'sunday': 6, 'sun': 6,
    }
    
    # Strategy 1: Parse "Day1 and Day2 at Time" pattern
    # e.g., "Monday and Tuesday at 9am"
    pattern1 = r'(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(?:\s+and\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)?\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)'
    matches1 = re.findall(pattern1, message, re.IGNORECASE)
    
    if matches1:
        for match in matches1:
            day1, day2, time_str = match
            days = [day1.lower()]
            if day2:
                days.append(day2.lower())
            
            parsed_time = parse_time(time_str)
            if parsed_time:
                for day in days:
                    if day in day_names:
                        target_date = get_next_weekday(current_date, day_names[day])
                        slots.append({
                            'date': target_date.strftime('%Y-%m-%d'),
                            'time': parsed_time
                        })
    
    # Strategy 2: Parse individual "Day at Time" patterns
    # e.g., "Monday at 9am and Wednesday at 2pm"
    pattern2 = r'(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s+at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)'
    matches2 = re.findall(pattern2, message, re.IGNORECASE)
    
    if matches2:
        for day, time_str in matches2:
            day = day.lower()
            parsed_time = parse_time(time_str)
            if parsed_time and day in day_names:
                target_date = get_next_weekday(current_date, day_names[day])
                slot = {
                    'date': target_date.strftime('%Y-%m-%d'),
                    'time': parsed_time
                }
                # Avoid duplicates
                if slot not in slots:
                    slots.append(slot)
    
    # Strategy 3: Parse "next Monday/Tuesday" patterns
    pattern3 = r'(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(?:.*?)(\d{1,2}(?::\d{2})?\s*(?:am|pm))'
    matches3 = re.findall(pattern3, message, re.IGNORECASE)
    
    if matches3:
        for day, time_str in matches3:
            day = day.lower()
            parsed_time = parse_time(time_str)
            if parsed_time and day in day_names:
                target_date = get_next_weekday(current_date, day_names[day])
                slot = {
                    'date': target_date.strftime('%Y-%m-%d'),
                    'time': parsed_time
                }
                if slot not in slots:
                    slots.append(slot)
    
    return slots


def parse_time(time_str: str) -> str:
    """
    Parse time string to HH:MM format.
    
    Examples:
    - "9am" -> "09:00"
    - "2:30pm" -> "14:30"
    - "10" -> "10:00"
    """
    time_str = time_str.lower().strip()
    
    # Extract hour, minute, and AM/PM
    match = re.match(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)?', time_str)
    if not match:
        return None
    
    hour = int(match.group(1))
    minute = int(match.group(2)) if match.group(2) else 0
    period = match.group(3)
    
    # Convert to 24-hour format
    if period == 'pm' and hour != 12:
        hour += 12
    elif period == 'am' and hour == 12:
        hour = 0
    
    # Validate
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return None
    
    return f"{hour:02d}:{minute:02d}"


def get_next_weekday(current_date: datetime, target_weekday: int) -> datetime:
    """
    Get the next occurrence of the target weekday.
    
    Args:
        current_date: Current date
        target_weekday: Target day of week (0=Monday, 6=Sunday)
    
    Returns:
        Date of the next occurrence
    """
    days_ahead = target_weekday - current_date.weekday()
    
    # If the day has already passed this week, get next week's occurrence
    if days_ahead <= 0:
        days_ahead += 7
    
    return current_date + timedelta(days=days_ahead)

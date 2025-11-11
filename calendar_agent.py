#!/usr/bin/env python3
"""
Calendar Agent - Detects dates/times in text and generates .ics calendar files
"""
import re
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple
from pathlib import Path
import uuid

try:
    from dateutil import parser as date_parser
    from dateutil.relativedelta import relativedelta
    DATEUTIL_AVAILABLE = True
except ImportError:
    DATEUTIL_AVAILABLE = False

try:
    from icalendar import Calendar, Event
    ICALENDAR_AVAILABLE = True
except ImportError:
    ICALENDAR_AVAILABLE = False


class CalendarAgent:
    """Agent that detects dates/times and generates .ics calendar files"""
    
    def __init__(self, output_dir: str = "calendar_files"):
        """
        Initialize the calendar agent
        
        Args:
            output_dir: Directory to save generated .ics files
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        # Date/time patterns
        self.date_patterns = [
            # ISO dates: 2024-01-15, 2024/01/15
            r'\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b',
            # US dates: 01/15/2024, 1/15/24
            r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',
            # European dates: 15/01/2024, 15/1/24
            r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',
            # Month day: January 15, Jan 15, Jan 15th
            r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th)?\b',
            # Full month names: January 15, 2024
            r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b',
            # Relative dates: today, tomorrow, next week, next Monday
            r'\b(?:today|tomorrow|next\s+(?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b',
            # Day of week: Monday, Tuesday, etc.
            r'\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b',
        ]
        
        # Time patterns
        self.time_patterns = [
            # 24-hour: 14:30, 14:30:00
            r'\b\d{1,2}:\d{2}(?::\d{2})?\b',
            # 12-hour: 2:30 PM, 2:30pm, 14:30
            r'\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)\b',
            # Time words: morning, afternoon, evening, noon, midnight
            r'\b(?:morning|afternoon|evening|noon|midnight)\b',
        ]
        
        # Combined date-time patterns
        self.datetime_patterns = [
            r'\b(?:at|@)\s+\d{1,2}:\d{2}',
            r'\b\d{1,2}:\d{2}\s+(?:AM|PM|am|pm)',
        ]
    
    def detect_dates(self, text: str) -> bool:
        """
        Detect if text contains dates or times
        
        Args:
            text: Input text to analyze
            
        Returns:
            True if dates/times are detected, False otherwise
        """
        text_lower = text.lower()
        
        # Check for date patterns
        for pattern in self.date_patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return True
        
        # Check for time patterns
        for pattern in self.time_patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return True
        
        # Check for combined datetime patterns
        for pattern in self.datetime_patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                return True
        
        # Check for common date/time keywords
        date_keywords = [
            'meeting', 'appointment', 'schedule', 'calendar', 'event',
            'tomorrow', 'today', 'next week', 'next month',
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
            'january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'
        ]
        
        if any(keyword in text_lower for keyword in date_keywords):
            # Additional check: look for time indicators nearby
            time_indicators = ['at', '@', ':', 'am', 'pm', 'morning', 'afternoon', 'evening']
            for indicator in time_indicators:
                if indicator in text_lower:
                    return True
        
        return False
    
    def parse_date_time(self, text: str) -> Optional[Dict]:
        """
        Parse date and time from text
        
        Args:
            text: Input text containing date/time information
            
        Returns:
            Dictionary with parsed date/time info or None
        """
        if not DATEUTIL_AVAILABLE:
            return None
        
        try:
            # First, try to parse the entire text with dateutil (handles natural language well)
            try:
                # Use dateutil's fuzzy parsing which handles natural language
                parsed_dt = date_parser.parse(text, fuzzy=True, default=datetime.now())
                
                # Check if we actually got a reasonable date (not just default)
                # If the parsed date is very close to now, it might be a false positive
                time_diff = abs((parsed_dt - datetime.now()).total_seconds())
                
                # If we found a date that's more than 1 minute different from now, or if it's in the future
                if time_diff > 60 or parsed_dt > datetime.now():
                    # Extract time components
                    start_dt = parsed_dt.replace(second=0, microsecond=0)
                    end_dt = start_dt + timedelta(hours=1)
                    
                    return {
                        'start': start_dt,
                        'end': end_dt,
                        'summary': self._extract_summary(text),
                        'description': text[:500],
                    }
            except (ValueError, TypeError):
                pass
            
            # Fallback: Extract potential date/time strings manually
            date_time_matches = []
            
            # Find date patterns
            for pattern in self.date_patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    date_time_matches.append((match.start(), match.group(), 'date'))
            
            # Find time patterns
            for pattern in self.time_patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    date_time_matches.append((match.start(), match.group(), 'time'))
            
            if not date_time_matches:
                return None
            
            # Sort by position in text
            date_time_matches.sort(key=lambda x: x[0])
            
            # Try to parse dates and times
            parsed_date = None
            parsed_time = None
            
            for _, match_text, match_type in date_time_matches:
                try:
                    if match_type == 'date':
                        # Handle relative dates
                        match_lower = match_text.lower()
                        text_lower = text.lower()
                        
                        if 'today' in text_lower:
                            parsed_date = datetime.now()
                        elif 'tomorrow' in text_lower:
                            parsed_date = datetime.now() + timedelta(days=1)
                        elif 'next week' in text_lower:
                            parsed_date = datetime.now() + timedelta(weeks=1)
                        elif 'next month' in text_lower:
                            parsed_date = datetime.now() + relativedelta(months=1)
                        else:
                            # Try to parse the date string
                            parsed_date = date_parser.parse(match_text, default=datetime.now())
                    elif match_type == 'time':
                        # Parse time
                        time_str = match_text
                        try:
                            if 'am' in time_str.lower() or 'pm' in time_str.lower():
                                # 12-hour format
                                parsed_time = date_parser.parse(time_str, default=datetime.now()).time()
                            else:
                                # 24-hour format
                                parsed_time = date_parser.parse(time_str, default=datetime.now()).time()
                        except:
                            # Try parsing with context
                            try:
                                parsed_time = date_parser.parse(f"{time_str} {datetime.now().year}", default=datetime.now()).time()
                            except:
                                pass
                except Exception:
                    continue
            
            # Combine date and time
            if parsed_date:
                if isinstance(parsed_date, datetime):
                    dt = parsed_date
                    # If we have a separate time, update it
                    if parsed_time:
                        dt = dt.replace(hour=parsed_time.hour, minute=parsed_time.minute, second=0, microsecond=0)
                else:
                    dt = datetime.combine(parsed_date.date(), parsed_time or datetime.now().time())
                    dt = dt.replace(second=0, microsecond=0)
                
                # Default to 1 hour duration if no end time specified
                end_dt = dt + timedelta(hours=1)
                
                return {
                    'start': dt,
                    'end': end_dt,
                    'summary': self._extract_summary(text),
                    'description': text[:500],  # First 500 chars as description
                }
        
        except Exception as e:
            print(f"Error parsing date/time: {e}")
            return None
        
        return None
    
    def _extract_summary(self, text: str) -> str:
        """Extract a summary/title for the event from text"""
        # Look for common patterns like "meeting about X", "call with Y"
        summary_patterns = [
            r'meeting\s+(?:about|regarding|for|with)\s+([^.?!]+)',
            r'call\s+(?:with|about)\s+([^.?!]+)',
            r'appointment\s+(?:with|for)\s+([^.?!]+)',
            r'event\s+(?:called|titled)\s+([^.?!]+)',
        ]
        
        for pattern in summary_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        
        # Default: use first sentence or first 50 chars
        sentences = re.split(r'[.!?]', text)
        if sentences:
            summary = sentences[0].strip()
            if len(summary) > 50:
                summary = summary[:50] + "..."
            return summary
        
        return "Calendar Event"
    
    def generate_ics_file(self, event_info: Dict, filename: Optional[str] = None) -> Optional[str]:
        """
        Generate a .ics calendar file
        
        Args:
            event_info: Dictionary with event information (start, end, summary, description)
            filename: Optional filename for the .ics file
            
        Returns:
            Path to generated .ics file or None if generation failed
        """
        if not ICALENDAR_AVAILABLE:
            print("Warning: icalendar library not available. Install with: pip install icalendar")
            return None
        
        try:
            # Create calendar
            cal = Calendar()
            cal.add('prodid', '-//Calendar Agent//EN')
            cal.add('version', '2.0')
            
            # Create event
            event = Event()
            event.add('uid', str(uuid.uuid4()))
            event.add('dtstart', event_info['start'])
            event.add('dtend', event_info['end'])
            event.add('summary', event_info.get('summary', 'Calendar Event'))
            event.add('description', event_info.get('description', ''))
            event.add('dtstamp', datetime.now())
            
            # Add to calendar
            cal.add_component(event)
            
            # Generate filename if not provided
            if not filename:
                timestamp = event_info['start'].strftime('%Y%m%d_%H%M%S')
                safe_summary = re.sub(r'[^\w\s-]', '', event_info.get('summary', 'event'))[:30]
                safe_summary = re.sub(r'[-\s]+', '-', safe_summary)
                filename = f"{safe_summary}_{timestamp}.ics"
            
            # Ensure .ics extension
            if not filename.endswith('.ics'):
                filename += '.ics'
            
            # Save file
            filepath = self.output_dir / filename
            with open(filepath, 'wb') as f:
                f.write(cal.to_ical())
            
            return str(filepath)
        
        except Exception as e:
            print(f"Error generating .ics file: {e}")
            return None
    
    def process_text(self, text: str) -> Optional[str]:
        """
        Process text to detect dates and generate .ics file if dates are found
        
        Args:
            text: Input text to process
            
        Returns:
            Path to generated .ics file if dates detected, None otherwise
        """
        # Check if dates are detected
        if not self.detect_dates(text):
            return None
        
        # Parse date/time information
        event_info = self.parse_date_time(text)
        
        if not event_info:
            return None
        
        # Generate .ics file
        ics_path = self.generate_ics_file(event_info)
        
        # command looks like this:
        return ics_path


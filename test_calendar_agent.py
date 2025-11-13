#!/usr/bin/env python3
"""
Test script for the calendar agent
"""
from calendar_agent import CalendarAgent

def test_calendar_agent():
    """Test the calendar agent with various date/time inputs"""
    agent = CalendarAgent()
    
    test_cases = [
        "Meeting tomorrow at 2 PM",
        "Call on January 15, 2024 at 3:30 PM",
        "Appointment next Monday at 10 AM",
        "Event on 2024-12-25 at 14:00",
        "Team meeting today at 4 PM",
        "No dates or times here",
        "Schedule a call for next week",
    ]
    
    print("Testing Calendar Agent\n" + "=" * 50)
    
    for i, test_text in enumerate(test_cases, 1):
        print(f"\nTest {i}: {test_text}")
        print("-" * 50)
        
        # Test detection
        has_dates = agent.detect_dates(test_text)
        print(f"Date detected: {has_dates}")
        
        if has_dates:
            # Test parsing and generation
            ics_path = agent.process_text(test_text)
            if ics_path:
                print(f" Generated .ics file: {ics_path}")
            else:
                print("Failed to generate .ics file")
        else:
            print("No dates detected (expected for some test cases)")

if __name__ == "__main__":
    test_calendar_agent()


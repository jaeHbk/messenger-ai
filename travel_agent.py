#!/usr/bin/env python3
"""
Travel Agent - Detects travel-related conversations and triggers web searches
for hotels/airbnbs or restaurant/location recommendations
"""
import re
from typing import Optional, Dict


class TravelAgent:
    """Agent that detects travel-related conversations and extracts location information"""
    
    def __init__(self):
        """Initialize the travel agent"""
        # Travel-related keywords
        self.travel_keywords = [
            'travel', 'trip', 'vacation', 'visit', 'going to', 'planning to visit',
            'traveling to', 'visiting', 'travelling', 'holiday', 'journey',
            'destination', 'going', 'flying to', 'driving to', 'heading to'
        ]
        
        # Accommodation keywords
        self.accommodation_keywords = [
            'hotel', 'airbnb', 'air bnb', 'accommodation', 'stay', 'lodging',
            'place to stay', 'where to stay', 'book a room', 'reservation',
            'cheap hotel', 'budget hotel', 'affordable hotel', 'hotel near',
            'airbnb near', 'stay near'
        ]
        
        # Restaurant/food keywords
        self.restaurant_keywords = [
            'restaurant', 'dining', 'food', 'eat', 'cuisine', 'cafe', 'café',
            'where to eat', 'best restaurant', 'good food', 'local food',
            'dining recommendation', 'food recommendation'
        ]
        
        # Location keywords
        self.location_keywords = [
            'location', 'place', 'attraction', 'sightseeing', 'things to do',
            'what to see', 'where to go', 'recommendation', 'suggest',
            'must see', 'must visit', 'popular', 'famous'
        ]
        
        # Common location patterns (cities, countries, landmarks)
        self.location_patterns = [
            r'\b(?:in|at|to|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b',  # "in Paris", "to New York"
            r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:hotel|restaurant|airbnb|city|place)\b',  # "Paris hotel"
            r'\b(?:going|traveling|visiting|flying|driving)\s+(?:to|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b',
        ]
    
    def detect_travel_conversation(self, text: str) -> bool:
        """
        Detect if text contains travel-related conversation
        
        Args:
            text: Input text to analyze
            
        Returns:
            True if travel conversation is detected, False otherwise
        """
        text_lower = text.lower()
        
        # Check for travel keywords
        has_travel_keyword = any(keyword in text_lower for keyword in self.travel_keywords)
        
        # Check for accommodation or restaurant keywords (strong indicators)
        has_accommodation = any(keyword in text_lower for keyword in self.accommodation_keywords)
        has_restaurant = any(keyword in text_lower for keyword in self.restaurant_keywords)
        has_location = any(keyword in text_lower for keyword in self.location_keywords)
        
        # Travel conversation detected if:
        # 1. Has travel keyword AND (accommodation OR restaurant OR location keyword)
        # 2. Has accommodation keyword (implies travel)
        # 3. Has restaurant keyword in travel context
        if has_travel_keyword and (has_accommodation or has_restaurant or has_location):
            return True
        
        if has_accommodation:
            return True
        
        if has_restaurant and has_travel_keyword:
            return True
        
        return False
    
    def extract_location(self, text: str) -> Optional[str]:
        """
        Extract location information from text
        
        Args:
            text: Input text to analyze
            
        Returns:
            Extracted location string or None
        """
        # Common false positives to filter out
        false_positives = {'the', 'a', 'an', 'to', 'in', 'at', 'near', 'around', 'this', 'that', 'there', 'here', 'where', 'what', 'when', 'how', 'why'}
        
        # Try location patterns (more specific patterns first)
        location_patterns_all = [
            # "going to Paris", "traveling to New York"
            r'(?:going|traveling|visiting|flying|driving|heading|planning\s+to\s+visit)\s+(?:to|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
            # "hotel in Paris", "restaurant in Tokyo"
            r'(?:hotel|restaurant|airbnb|accommodation|stay|place)\s+(?:in|at|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)',
            # "Paris hotel", "Tokyo restaurant"
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:hotel|restaurant|airbnb|city|place|destination|area)',
            # "in Paris", "at Tokyo", "near San Francisco"
            r'\b(?:in|at|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b',
        ]
        
        for pattern in location_patterns_all:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                if match.groups():
                    location = match.group(1).strip()
                    # Filter out false positives and ensure it's a valid location
                    location_lower = location.lower()
                    if (location and 
                        len(location) > 2 and 
                        location_lower not in false_positives and
                        not location_lower.startswith('the ') and
                        not location_lower.startswith('a ') and
                        not location_lower.startswith('an ')):
                        return location
        
        return None
    
    def determine_search_type(self, text: str) -> str:
        """
        Determine what type of search to perform
        
        Args:
            text: Input text to analyze
            
        Returns:
            'accommodation' for hotels/airbnbs, 'recommendations' for restaurants/locations, or 'both'
        """
        text_lower = text.lower()
        
        has_accommodation = any(keyword in text_lower for keyword in self.accommodation_keywords)
        has_restaurant = any(keyword in text_lower for keyword in self.restaurant_keywords)
        has_location = any(keyword in text_lower for keyword in self.location_keywords)
        
        if has_accommodation and (has_restaurant or has_location):
            return 'both'
        elif has_accommodation:
            return 'accommodation'
        elif has_restaurant or has_location:
            return 'recommendations'
        else:
            # Default to both if travel is detected but no specific preference
            return 'both'
    
    def process_text(self, text: str) -> Optional[Dict[str, str]]:
        """
        Process text to detect travel conversations and extract information
        
        Args:
            text: Input text to process
            
        Returns:
            Dictionary with travel information if detected, None otherwise
            Format: {
                'location': str,
                'search_type': 'accommodation' | 'recommendations' | 'both',
                'enhanced_query': str
            }
        """
        # Check if travel conversation is detected
        if not self.detect_travel_conversation(text):
            return None
        
        # Extract location
        location = self.extract_location(text)
        
        # Determine search type
        search_type = self.determine_search_type(text)
        
        # Create enhanced query for web search
        enhanced_query = self._create_enhanced_query(text, location, search_type)
        
        return {
            'location': location,
            'search_type': search_type,
            'enhanced_query': enhanced_query
        }
    
    def _create_enhanced_query(self, original_text: str, location: Optional[str], search_type: str) -> str:
        """
        Create an enhanced query with specific travel search instructions
        
        Args:
            original_text: Original user query
            location: Extracted location (if any)
            search_type: Type of search to perform
            
        Returns:
            Enhanced query string
        """
        search_instructions = []
        
        if search_type == 'accommodation' or search_type == 'both':
            if location:
                search_instructions.append(f"Search for cheap hotels and Airbnbs near {location}")
            else:
                search_instructions.append("Search for cheap hotels and Airbnbs in the mentioned area")
        
        if search_type == 'recommendations' or search_type == 'both':
            if location:
                search_instructions.append(f"Search for travel location and restaurant recommendations in {location}")
            else:
                search_instructions.append("Search for travel location and restaurant recommendations in the mentioned area")
        
        if search_instructions:
            instructions = ". ".join(search_instructions) + "."
            return f"{original_text}\n\nPlease perform web searches to find: {instructions} Provide specific recommendations with prices and locations when available."
        
        return original_text


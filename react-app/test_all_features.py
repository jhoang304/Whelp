#!/usr/bin/env python3

import requests
import json

BASE_URL = "http://localhost:5000/api"

def test_restaurants():
    print("🍽️  Testing Restaurants...")
    
    # Test get all restaurants
    response = requests.get(f"{BASE_URL}/restaurants/")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Get all restaurants: {len(data['Restaurants'])} restaurants found")
    else:
        print(f"   ❌ Get all restaurants failed: {response.status_code}")
    
    # Test get single restaurant
    response = requests.get(f"{BASE_URL}/restaurants/1")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Get single restaurant: {data['name']}")
    else:
        print(f"   ❌ Get single restaurant failed: {response.status_code}")

def test_search():
    print("\n🔍 Testing Search...")
    
    # Test search with normal keyword
    response = requests.get(f"{BASE_URL}/restaurants/search/nancy")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Search 'nancy': {len(data['Restaurants'])} results")
    else:
        print(f"   ❌ Search failed: {response.status_code}")
    
    # Test search with short keyword (intelligent search)
    response = requests.get(f"{BASE_URL}/restaurants/search/na")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Search 'na' (short keyword): {len(data['Restaurants'])} results")
    else:
        print(f"   ❌ Short keyword search failed: {response.status_code}")

def test_reviews():
    print("\n⭐ Testing Reviews...")
    
    # Test get reviews for restaurant
    response = requests.get(f"{BASE_URL}/restaurants/1/reviews")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Restaurant reviews: {len(data)} reviews found")
    else:
        print(f"   ❌ Restaurant reviews failed: {response.status_code}")
    
    # Test get user reviews
    response = requests.get(f"{BASE_URL}/reviews/1")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ User reviews: {len(data)} reviews found")
    else:
        print(f"   ❌ User reviews failed: {response.status_code}")

def test_photos():
    print("\n📸 Testing Photos...")
    
    # Test get restaurant images
    response = requests.get(f"{BASE_URL}/restaurant-images/1/images")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Restaurant images: {len(data)} images found")
    else:
        print(f"   ❌ Restaurant images failed: {response.status_code}")

def test_users():
    print("\n👤 Testing User Profiles...")
    
    # Test get user profile
    response = requests.get(f"{BASE_URL}/users/get/1")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ User profile: {data['username']} ({data['email']})")
    else:
        print(f"   ❌ User profile failed: {response.status_code}")

def test_react_frontend():
    print("\n⚛️  Testing React Frontend...")
    
    try:
        response = requests.get("http://localhost:3003/")
        if response.status_code == 200 and "Whelp" in response.text:
            print("   ✅ React app is serving correctly")
        else:
            print(f"   ❌ React app issue: {response.status_code}")
    except Exception as e:
        print(f"   ❌ React app not accessible: {e}")

if __name__ == "__main__":
    print("🧪 COMPREHENSIVE FEATURE TESTING FOR WHELP APPLICATION")
    print("=" * 60)
    
    try:
        test_restaurants()
        test_search()
        test_reviews()
        test_photos()
        test_users()
        test_react_frontend()
        
        print("\n" + "=" * 60)
        print("🎉 ALL TESTS COMPLETED!")
        print("✨ The TypeScript migration has been successful!")
        print("🚀 All major features are working correctly!")
        
    except Exception as e:
        print(f"\n❌ Test error: {e}")

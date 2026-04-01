import requests
import sys
import json
from datetime import datetime

class AIVideodubbingAPITester:
    def __init__(self, base_url="https://vocal-forge-28.preview.emergentagent.com"):
        self.base_url = base_url
        self.session = requests.Session()
        self.tests_run = 0
        self.tests_passed = 0
        self.user_data = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'} if not files else {}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    response = self.session.post(url, files=files, data=data)
                else:
                    response = self.session.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:200]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:300]}...")

            return success, response.json() if response.text and response.status_code != 204 else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_credit_packages(self):
        """Test GET /api/credit-packages"""
        success, response = self.run_test(
            "Get Credit Packages",
            "GET",
            "api/credit-packages",
            200
        )
        if success:
            expected_packages = ["starter", "pro", "premium"]
            for pkg in expected_packages:
                if pkg not in response:
                    print(f"❌ Missing package: {pkg}")
                    return False
            print("✅ All credit packages present")
        return success

    def test_register_user(self):
        """Test user registration"""
        test_user_data = {
            "name": "Test User",
            "email": f"testuser_{datetime.now().strftime('%H%M%S')}@example.com",
            "password": "testpass123"
        }
        
        success, response = self.run_test(
            "Register New User",
            "POST",
            "api/auth/register",
            200,
            data=test_user_data
        )
        
        if success:
            self.user_data = response
            # Check if user received 100 trial credits
            if response.get('trial_credits') == 100:
                print("✅ User received 100 trial credits")
            else:
                print(f"❌ Expected 100 trial credits, got {response.get('trial_credits')}")
                return False
        
        return success

    def test_login_user(self):
        """Test user login with admin credentials"""
        login_data = {
            "email": "admin@example.com",
            "password": "admin123"
        }
        
        success, response = self.run_test(
            "Login Admin User",
            "POST",
            "api/auth/login",
            200,
            data=login_data
        )
        
        if success:
            self.user_data = response
            print(f"✅ Logged in as: {response.get('name')} ({response.get('email')})")
        
        return success

    def test_get_current_user(self):
        """Test GET /api/auth/me"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "api/auth/me",
            200
        )
        
        if success and response:
            print(f"✅ Current user: {response.get('name')} - Credits: {response.get('credits')}, Trial: {response.get('trial_credits')}")
        
        return success

    def test_upload_video(self):
        """Test video upload endpoint"""
        # Create a dummy video file for testing
        dummy_video_content = b"dummy video content for testing"
        files = {'file': ('test_video.mp4', dummy_video_content, 'video/mp4')}
        
        success, response = self.run_test(
            "Upload Video File",
            "POST",
            "api/upload-video",
            200,
            files=files
        )
        
        if success:
            if 'file_id' in response and 'url' in response:
                print("✅ Video upload successful with file_id and url")
                return response.get('url')
            else:
                print("❌ Missing file_id or url in response")
                return False
        
        return False

    def test_create_project(self, video_url=None):
        """Test project creation"""
        if not video_url:
            video_url = "/api/files/test-video.mp4"
        
        project_data = {
            "video_url": video_url,
            "voice_instructions": "Make the voice female, slightly deep pitch, slow speaking rate",
            "target_language": "en"
        }
        
        success, response = self.run_test(
            "Create Dubbing Project",
            "POST",
            "api/projects",
            200,
            data=project_data
        )
        
        if success:
            required_fields = ['id', 'user_id', 'status', 'video_url', 'voice_instructions']
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing field in project response: {field}")
                    return False
            print("✅ Project created with all required fields")
        
        return success

    def test_get_projects(self):
        """Test GET /api/projects"""
        success, response = self.run_test(
            "Get User Projects",
            "GET",
            "api/projects",
            200
        )
        
        if success:
            if isinstance(response, list):
                print(f"✅ Retrieved {len(response)} projects")
            else:
                print("❌ Projects response should be a list")
                return False
        
        return success

    def test_create_checkout_session(self):
        """Test Stripe checkout session creation"""
        checkout_data = {
            "origin_url": "https://vocal-forge-28.preview.emergentagent.com"
        }
        
        success, response = self.run_test(
            "Create Stripe Checkout Session",
            "POST",
            "api/payments/checkout?package_id=starter",
            200,
            data=checkout_data
        )
        
        if success:
            if 'url' in response and 'session_id' in response:
                print("✅ Checkout session created with URL and session_id")
                return response.get('session_id')
            else:
                print("❌ Missing url or session_id in checkout response")
                return False
        
        return False

    def test_logout(self):
        """Test user logout"""
        success, response = self.run_test(
            "Logout User",
            "POST",
            "api/auth/logout",
            200
        )
        
        if success:
            print("✅ User logged out successfully")
        
        return success

def main():
    print("🚀 Starting AI Video Dubbing API Tests")
    print("=" * 50)
    
    tester = AIVideodubbingAPITester()
    
    # Test sequence
    tests = [
        ("Credit Packages", tester.test_credit_packages),
        ("User Registration", tester.test_register_user),
        ("User Login", tester.test_login_user),
        ("Get Current User", tester.test_get_current_user),
        ("Upload Video", tester.test_upload_video),
        ("Create Project", lambda: tester.test_create_project()),
        ("Get Projects", tester.test_get_projects),
        ("Create Checkout", tester.test_create_checkout_session),
        ("Logout", tester.test_logout),
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if not result:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"❌ Failed tests: {', '.join(failed_tests)}")
        return 1
    else:
        print("✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())
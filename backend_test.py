import requests
import sys
import json
from datetime import datetime

class SmartShoppingAPITester:
    def __init__(self, base_url="https://stock-tracker-694.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "status": "PASS" if success else "FAIL",
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status_icon = "✅" if success else "❌"
        print(f"{status_icon} {name}: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json()
                    details = f"Status: {response.status_code}"
                    if isinstance(response_data, list):
                        details += f", Items: {len(response_data)}"
                    elif isinstance(response_data, dict) and 'message' in response_data:
                        details += f", Message: {response_data['message']}"
                except:
                    details = f"Status: {response.status_code}"
            else:
                details = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_data = response.json()
                    if 'detail' in error_data:
                        details += f", Error: {error_data['detail']}"
                except:
                    details += f", Response: {response.text[:100]}"

            self.log_test(name, success, details)
            return success, response.json() if success else {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_api_root(self):
        """Test API root endpoint"""
        return self.run_test("API Root", "GET", "", 200)

    def test_get_products(self):
        """Test getting all products"""
        success, data = self.run_test("Get All Products", "GET", "products", 200)
        if success and isinstance(data, list):
            print(f"   Found {len(data)} products in database")
            if len(data) > 0:
                sample_product = data[0]
                required_fields = ['id', 'nome', 'categoria', 'quantidade_atual', 'quantidade_minima', 'unidade']
                missing_fields = [field for field in required_fields if field not in sample_product]
                if missing_fields:
                    print(f"   ⚠️  Missing fields in product: {missing_fields}")
                else:
                    print(f"   ✅ Product structure is correct")
        return success, data

    def test_get_categories(self):
        """Test getting product categories"""
        success, data = self.run_test("Get Categories", "GET", "products/categories", 200)
        if success and 'categories' in data:
            print(f"   Found {len(data['categories'])} categories: {data['categories'][:5]}")
        return success, data

    def test_create_product(self):
        """Test creating a new product"""
        test_product = {
            "nome": "Produto Teste API",
            "categoria": "Teste",
            "quantidade_atual": 5.0,
            "quantidade_minima": 10.0,
            "unidade": "un"
        }
        success, data = self.run_test("Create Product", "POST", "products", 200, test_product)
        if success and 'id' in data:
            print(f"   Created product with ID: {data['id']}")
            return success, data
        return success, {}

    def test_update_product_stock(self, product_id):
        """Test updating product stock"""
        stock_update = {"quantidade_atual": 15.0}
        return self.run_test(
            f"Update Stock (ID: {product_id[:8]}...)", 
            "PUT", 
            f"products/{product_id}/stock", 
            200, 
            stock_update
        )

    def test_get_single_product(self, product_id):
        """Test getting a single product"""
        return self.run_test(
            f"Get Single Product (ID: {product_id[:8]}...)", 
            "GET", 
            f"products/{product_id}", 
            200
        )

    def test_update_product(self, product_id):
        """Test updating a product"""
        update_data = {
            "nome": "Produto Teste Atualizado",
            "categoria": "Teste Atualizado"
        }
        return self.run_test(
            f"Update Product (ID: {product_id[:8]}...)", 
            "PUT", 
            f"products/{product_id}", 
            200, 
            update_data
        )

    def test_get_shopping_list(self):
        """Test getting shopping list"""
        success, data = self.run_test("Get Shopping List", "GET", "shopping-list", 200)
        if success and isinstance(data, list):
            print(f"   Found {len(data)} items in shopping list")
            if len(data) > 0:
                sample_item = data[0]
                required_fields = ['product_id', 'produto_nome', 'categoria', 'quantidade_necessaria', 'unidade']
                missing_fields = [field for field in required_fields if field not in sample_item]
                if missing_fields:
                    print(f"   ⚠️  Missing fields in shopping item: {missing_fields}")
                else:
                    print(f"   ✅ Shopping list item structure is correct")
        return success, data

    def test_delete_product(self, product_id):
        """Test deleting a product"""
        return self.run_test(
            f"Delete Product (ID: {product_id[:8]}...)", 
            "DELETE", 
            f"products/{product_id}", 
            200
        )

    def run_comprehensive_test(self):
        """Run all API tests"""
        print("🚀 Starting Smart Shopping API Tests")
        print("=" * 50)

        # Test basic endpoints
        self.test_api_root()
        
        # Test product operations
        success, products = self.test_get_products()
        if not success:
            print("❌ Cannot proceed without product data")
            return False

        self.test_get_categories()
        
        # Test CRUD operations
        success, new_product = self.test_create_product()
        if success and 'id' in new_product:
            product_id = new_product['id']
            
            # Test operations on the created product
            self.test_get_single_product(product_id)
            self.test_update_product_stock(product_id)
            self.test_update_product(product_id)
            
            # Test shopping list (should include our test product if stock is low)
            self.test_get_shopping_list()
            
            # Clean up - delete test product
            self.test_delete_product(product_id)
        
        # Final shopping list test
        self.test_get_shopping_list()

        # Print summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check details above.")
            return False

def main():
    tester = SmartShoppingAPITester()
    success = tester.run_comprehensive_test()
    
    # Save detailed results
    with open('/app/backend_api_test_results.json', 'w') as f:
        json.dump({
            'summary': {
                'total_tests': tester.tests_run,
                'passed_tests': tester.tests_passed,
                'success_rate': f"{(tester.tests_passed/tester.tests_run*100):.1f}%" if tester.tests_run > 0 else "0%",
                'timestamp': datetime.now().isoformat()
            },
            'detailed_results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())
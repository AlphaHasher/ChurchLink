"""
Unit tests for conditional visibility evaluation logic in forms.

Tests both single and multiple condition expressions with AND (&&) and OR (||) operators.
"""

from models.form import _evaluate_visibility


class TestSingleConditionVisibility:
    """Test single condition expressions."""

    def test_no_condition_returns_true(self):
        """Field with no visibleIf should always be visible."""
        assert _evaluate_visibility(None, {}) is True
        assert _evaluate_visibility("", {}) is True
        assert _evaluate_visibility("   ", {}) is True

    def test_equality_operator_string(self):
        """Test == operator with string values."""
        assert _evaluate_visibility('country == "USA"', {"country": "USA"}) is True
        assert _evaluate_visibility('country == "USA"', {"country": "Canada"}) is False
        assert _evaluate_visibility("country == 'USA'", {"country": "USA"}) is True

    def test_equality_operator_boolean(self):
        """Test == operator with boolean values."""
        assert _evaluate_visibility("subscribe == true", {"subscribe": True}) is True
        assert _evaluate_visibility("subscribe == false", {"subscribe": False}) is True
        assert _evaluate_visibility("subscribe == true", {"subscribe": False}) is False
        assert _evaluate_visibility("subscribe == True", {"subscribe": True}) is True  # Case insensitive

    def test_equality_operator_number(self):
        """Test == operator with numeric values."""
        assert _evaluate_visibility("age == 18", {"age": 18}) is True
        assert _evaluate_visibility("age == 18", {"age": 18.0}) is True
        assert _evaluate_visibility("age == 18", {"age": 19}) is False
        assert _evaluate_visibility("price == 99.99", {"price": 99.99}) is True

    def test_inequality_operator(self):
        """Test != operator."""
        assert _evaluate_visibility('country != "USA"', {"country": "Canada"}) is True
        assert _evaluate_visibility('country != "USA"', {"country": "USA"}) is False
        assert _evaluate_visibility("age != 18", {"age": 19}) is True
        assert _evaluate_visibility("subscribe != true", {"subscribe": False}) is True

    def test_greater_than_or_equal(self):
        """Test >= operator."""
        assert _evaluate_visibility("age >= 18", {"age": 18}) is True
        assert _evaluate_visibility("age >= 18", {"age": 19}) is True
        assert _evaluate_visibility("age >= 18", {"age": 17}) is False
        assert _evaluate_visibility("age >= 18", {"age": 18.0}) is True

    def test_less_than_or_equal(self):
        """Test <= operator."""
        assert _evaluate_visibility("age <= 65", {"age": 65}) is True
        assert _evaluate_visibility("age <= 65", {"age": 64}) is True
        assert _evaluate_visibility("age <= 65", {"age": 66}) is False

    def test_greater_than(self):
        """Test > operator."""
        assert _evaluate_visibility("age > 18", {"age": 19}) is True
        assert _evaluate_visibility("age > 18", {"age": 18}) is False
        assert _evaluate_visibility("age > 18", {"age": 17}) is False

    def test_less_than(self):
        """Test < operator."""
        assert _evaluate_visibility("age < 18", {"age": 17}) is True
        assert _evaluate_visibility("age < 18", {"age": 18}) is False
        assert _evaluate_visibility("age < 18", {"age": 19}) is False

    def test_missing_field_defaults_visible(self):
        """When referenced field doesn't exist, behavior depends on operator."""
        # For >= operator with None, comparison throws exception, defaults to visible
        assert _evaluate_visibility("age >= 18", {}) is True
        
        # For == operator with None, comparison returns False (None == "USA" is False)
        assert _evaluate_visibility('country == "USA"', {}) is False
        
        # Invalid syntax always defaults to visible
        assert _evaluate_visibility("invalid", {}) is True

    def test_invalid_syntax_defaults_visible(self):
        """Invalid condition syntax should default to visible."""
        assert _evaluate_visibility("invalid condition", {"age": 18}) is True
        assert _evaluate_visibility("age", {"age": 18}) is True
        assert _evaluate_visibility("== 18", {"age": 18}) is True

    def test_whitespace_handling(self):
        """Test that extra whitespace is handled correctly."""
        assert _evaluate_visibility("  age   >=   18  ", {"age": 20}) is True
        assert _evaluate_visibility("country=='USA'", {"country": "USA"}) is True


class TestMultipleConditionsAND:
    """Test multiple conditions with AND (&&) operator."""

    def test_and_both_true(self):
        """Both conditions true should return True."""
        values = {"age": 21, "subscribe": True}
        assert _evaluate_visibility("age >= 18 && subscribe == true", values) is True

    def test_and_first_false(self):
        """First condition false should return False."""
        values = {"age": 16, "subscribe": True}
        assert _evaluate_visibility("age >= 18 && subscribe == true", values) is False

    def test_and_second_false(self):
        """Second condition false should return False."""
        values = {"age": 21, "subscribe": False}
        assert _evaluate_visibility("age >= 18 && subscribe == true", values) is False

    def test_and_both_false(self):
        """Both conditions false should return False."""
        values = {"age": 16, "subscribe": False}
        assert _evaluate_visibility("age >= 18 && subscribe == true", values) is False

    def test_and_three_conditions(self):
        """Test three conditions chained with AND."""
        values = {"age": 21, "subscribe": True, "member": True}
        assert _evaluate_visibility("age >= 18 && subscribe == true && member == true", values) is True
        
        values = {"age": 21, "subscribe": True, "member": False}
        assert _evaluate_visibility("age >= 18 && subscribe == true && member == true", values) is False

    def test_and_with_different_operators(self):
        """Test AND with various comparison operators."""
        values = {"age": 25, "country": "USA", "score": 85}
        assert _evaluate_visibility('age > 18 && country == "USA"', values) is True
        assert _evaluate_visibility('age > 18 && score >= 80', values) is True
        assert _evaluate_visibility('age < 30 && score > 90', values) is False


class TestMultipleConditionsOR:
    """Test multiple conditions with OR (||) operator."""

    def test_or_both_true(self):
        """Both conditions true should return True."""
        values = {"country": "USA", "country2": "Canada"}
        assert _evaluate_visibility('country == "USA" || country2 == "Canada"', values) is True

    def test_or_first_true(self):
        """First condition true should return True."""
        values = {"country": "USA", "country2": "Mexico"}
        assert _evaluate_visibility('country == "USA" || country2 == "Canada"', values) is True

    def test_or_second_true(self):
        """Second condition true should return True."""
        values = {"country": "Mexico", "country2": "Canada"}
        assert _evaluate_visibility('country == "USA" || country2 == "Canada"', values) is True

    def test_or_both_false(self):
        """Both conditions false should return False."""
        values = {"country": "Mexico", "country2": "Brazil"}
        assert _evaluate_visibility('country == "USA" || country2 == "Canada"', values) is False

    def test_or_three_conditions(self):
        """Test three conditions chained with OR."""
        values = {"plan": "basic", "trial": False, "admin": False}
        assert _evaluate_visibility('plan == "premium" || trial == true || admin == true', values) is False
        
        values = {"plan": "basic", "trial": True, "admin": False}
        assert _evaluate_visibility('plan == "premium" || trial == true || admin == true', values) is True

    def test_or_with_different_operators(self):
        """Test OR with various comparison operators."""
        values = {"age": 15, "guardian": True}
        assert _evaluate_visibility("age >= 18 || guardian == true", values) is True
        
        values = {"age": 15, "guardian": False}
        assert _evaluate_visibility("age >= 18 || guardian == true", values) is False


class TestMixedANDandOR:
    """Test expressions with both AND and OR operators."""

    def test_and_has_higher_precedence(self):
        """AND should be evaluated before OR (higher precedence)."""
        # Expression: A || B && C
        # Should be evaluated as: A || (B && C)
        
        # Case 1: A=False, B=True, C=True -> False || True = True
        values = {"a": False, "b": True, "c": True}
        assert _evaluate_visibility("a == true || b == true && c == true", values) is True
        
        # Case 2: A=False, B=True, C=False -> False || False = False
        values = {"a": False, "b": True, "c": False}
        assert _evaluate_visibility("a == true || b == true && c == true", values) is False
        
        # Case 3: A=True, B=False, C=False -> True || False = True
        values = {"a": True, "b": False, "c": False}
        assert _evaluate_visibility("a == true || b == true && c == true", values) is True

    def test_complex_expression_real_world(self):
        """Test a realistic complex expression."""
        # Show field if: (user is 18+ and subscribed) OR (user is admin)
        values = {"age": 21, "subscribe": True, "admin": False}
        assert _evaluate_visibility("age >= 18 && subscribe == true || admin == true", values) is True
        
        values = {"age": 16, "subscribe": True, "admin": False}
        assert _evaluate_visibility("age >= 18 && subscribe == true || admin == true", values) is False
        
        values = {"age": 16, "subscribe": False, "admin": True}
        assert _evaluate_visibility("age >= 18 && subscribe == true || admin == true", values) is True

    def test_multiple_or_with_and_groups(self):
        """Test multiple OR conditions where each has AND subconditions."""
        # (age >= 18 && member == true) || (admin == true && approved == true)
        values = {"age": 21, "member": True, "admin": False, "approved": False}
        result = _evaluate_visibility(
            "age >= 18 && member == true || admin == true && approved == true",
            values
        )
        assert result is True
        
        values = {"age": 16, "member": True, "admin": True, "approved": True}
        result = _evaluate_visibility(
            "age >= 18 && member == true || admin == true && approved == true",
            values
        )
        assert result is True
        
        values = {"age": 16, "member": False, "admin": True, "approved": False}
        result = _evaluate_visibility(
            "age >= 18 && member == true || admin == true && approved == true",
            values
        )
        assert result is False


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_type_mismatch_comparison(self):
        """Type mismatches: >= throws exception (visible), == returns False (hidden)."""
        # >= with string throws TypeError, defaults to visible
        assert _evaluate_visibility("age >= 18", {"age": "not a number"}) is True
        
        # == doesn't throw exception, just returns False ("yes" == True is False)
        assert _evaluate_visibility("subscribe == true", {"subscribe": "yes"}) is False

    def test_empty_condition_parts(self):
        """Empty parts in AND/OR expressions should be handled."""
        assert _evaluate_visibility("age >= 18 && ", {"age": 21}) is True
        assert _evaluate_visibility(" || age >= 18", {"age": 21}) is True

    def test_whitespace_in_compound_conditions(self):
        """Extra whitespace in compound conditions should be handled."""
        values = {"age": 21, "subscribe": True}
        assert _evaluate_visibility("  age >= 18   &&   subscribe == true  ", values) is True
        assert _evaluate_visibility("age>=18&&subscribe==true", values) is True

    def test_zero_and_empty_string_values(self):
        """Test with zero and empty string values."""
        assert _evaluate_visibility("count == 0", {"count": 0}) is True
        assert _evaluate_visibility("count > 0", {"count": 0}) is False
        assert _evaluate_visibility('name == ""', {"name": ""}) is True
        assert _evaluate_visibility('name != ""', {"name": ""}) is False

    def test_none_values(self):
        """Test with None values - == comparison returns False, field is hidden."""
        # None == True evaluates to False without throwing exception
        assert _evaluate_visibility("field == true", {"field": None}) is False
        
        # None == False also evaluates to False
        assert _evaluate_visibility("field == false", {"field": None}) is False
        
        # But >= with None throws exception, defaults to visible
        assert _evaluate_visibility("field >= 0", {"field": None}) is True


class TestRealWorldScenarios:
    """Test realistic form visibility scenarios."""

    def test_age_restricted_content(self):
        """Show field only for adults."""
        condition = "age >= 18"
        assert _evaluate_visibility(condition, {"age": 18}) is True
        assert _evaluate_visibility(condition, {"age": 25}) is True
        assert _evaluate_visibility(condition, {"age": 17}) is False

    def test_subscriber_exclusive_field(self):
        """Show field only for subscribers who are also verified."""
        condition = "subscriber == true && verified == true"
        assert _evaluate_visibility(condition, {"subscriber": True, "verified": True}) is True
        assert _evaluate_visibility(condition, {"subscriber": True, "verified": False}) is False
        assert _evaluate_visibility(condition, {"subscriber": False, "verified": True}) is False

    def test_country_specific_field(self):
        """Show field for multiple countries."""
        condition = 'country == "USA" || country == "Canada" || country == "Mexico"'
        assert _evaluate_visibility(condition, {"country": "USA"}) is True
        assert _evaluate_visibility(condition, {"country": "Canada"}) is True
        assert _evaluate_visibility(condition, {"country": "UK"}) is False

    def test_conditional_shipping_field(self):
        """Show shipping field if: (physical product) OR (gift wrapping selected)."""
        condition = "physical == true || gift_wrap == true"
        assert _evaluate_visibility(condition, {"physical": True, "gift_wrap": False}) is True
        assert _evaluate_visibility(condition, {"physical": False, "gift_wrap": True}) is True
        assert _evaluate_visibility(condition, {"physical": False, "gift_wrap": False}) is False

    def test_employee_or_student_discount(self):
        """Show discount field if user is employee or student with valid ID."""
        condition = "employee == true || student == true && has_valid_id == true"
        
        # Employee (even without ID)
        assert _evaluate_visibility(condition, {"employee": True, "student": False, "has_valid_id": False}) is True
        
        # Student with valid ID
        assert _evaluate_visibility(condition, {"employee": False, "student": True, "has_valid_id": True}) is True
        
        # Student without valid ID
        assert _evaluate_visibility(condition, {"employee": False, "student": True, "has_valid_id": False}) is False
        
        # Neither
        assert _evaluate_visibility(condition, {"employee": False, "student": False, "has_valid_id": True}) is False


class TestUnlimitedChaining:
    """Test unlimited chaining of conditions."""

    def test_five_and_conditions(self):
        """Test five conditions chained with AND."""
        condition = "a == true && b == true && c == true && d == true && e == true"
        
        # All true
        values = {"a": True, "b": True, "c": True, "d": True, "e": True}
        assert _evaluate_visibility(condition, values) is True
        
        # One false in the middle
        values = {"a": True, "b": True, "c": False, "d": True, "e": True}
        assert _evaluate_visibility(condition, values) is False
        
        # Last one false
        values = {"a": True, "b": True, "c": True, "d": True, "e": False}
        assert _evaluate_visibility(condition, values) is False

    def test_five_or_conditions(self):
        """Test five conditions chained with OR."""
        condition = 'country == "USA" || country == "Canada" || country == "Mexico" || country == "UK" || country == "France"'
        
        # Match first
        assert _evaluate_visibility(condition, {"country": "USA"}) is True
        
        # Match middle
        assert _evaluate_visibility(condition, {"country": "Mexico"}) is True
        
        # Match last
        assert _evaluate_visibility(condition, {"country": "France"}) is True
        
        # No match
        assert _evaluate_visibility(condition, {"country": "Germany"}) is False

    def test_ten_conditions_mixed(self):
        """Test ten conditions with mixed AND/OR."""
        # Complex: (age check AND subscription checks) OR (admin checks) OR (special access)
        condition = (
            "age >= 18 && subscribe == true && verified == true || "
            "admin == true && approved == true || "
            "special_access == true && member == true && active == true && premium == true"
        )
        
        # Match first group (age + subscription)
        values = {
            "age": 21, "subscribe": True, "verified": True,
            "admin": False, "approved": False,
            "special_access": False, "member": False, "active": False, "premium": False
        }
        assert _evaluate_visibility(condition, values) is True
        
        # Match second group (admin)
        values = {
            "age": 15, "subscribe": False, "verified": False,
            "admin": True, "approved": True,
            "special_access": False, "member": False, "active": False, "premium": False
        }
        assert _evaluate_visibility(condition, values) is True
        
        # Match third group (special access)
        values = {
            "age": 15, "subscribe": False, "verified": False,
            "admin": False, "approved": False,
            "special_access": True, "member": True, "active": True, "premium": True
        }
        assert _evaluate_visibility(condition, values) is True
        
        # No match
        values = {
            "age": 15, "subscribe": False, "verified": False,
            "admin": False, "approved": False,
            "special_access": False, "member": False, "active": False, "premium": False
        }
        assert _evaluate_visibility(condition, values) is False

    def test_twenty_or_conditions(self):
        """Test twenty countries in OR chain."""
        countries = ["USA", "Canada", "Mexico", "UK", "France", "Germany", "Italy", "Spain", 
                    "Brazil", "Argentina", "Japan", "China", "India", "Australia", "Russia",
                    "Egypt", "Kenya", "Nigeria", "Ghana", "Morocco"]
        
        condition = " || ".join([f'country == "{c}"' for c in countries])
        
        # Test each country matches
        for country in countries:
            assert _evaluate_visibility(condition, {"country": country}) is True
        
        # Test non-matching country
        assert _evaluate_visibility(condition, {"country": "Antarctica"}) is False

    def test_complex_real_world_scenario(self):
        """Test a complex real-world enrollment form scenario."""
        # Show payment field if:
        # - Student (age < 18) with parent consent
        # - OR Adult (age >= 18) who is either verified OR has referral
        # - OR Staff member with any age and department approval
        condition = (
            "age < 18 && parent_consent == true || "
            "age >= 18 && verified == true || "
            "age >= 18 && has_referral == true || "
            "staff == true && dept_approval == true"
        )
        
        # Student with parent consent
        assert _evaluate_visibility(condition, {
            "age": 16, "parent_consent": True, "verified": False, 
            "has_referral": False, "staff": False, "dept_approval": False
        }) is True
        
        # Student without parent consent
        assert _evaluate_visibility(condition, {
            "age": 16, "parent_consent": False, "verified": False, 
            "has_referral": False, "staff": False, "dept_approval": False
        }) is False
        
        # Adult verified
        assert _evaluate_visibility(condition, {
            "age": 25, "parent_consent": False, "verified": True, 
            "has_referral": False, "staff": False, "dept_approval": False
        }) is True
        
        # Adult with referral
        assert _evaluate_visibility(condition, {
            "age": 25, "parent_consent": False, "verified": False, 
            "has_referral": True, "staff": False, "dept_approval": False
        }) is True
        
        # Staff with department approval
        assert _evaluate_visibility(condition, {
            "age": 30, "parent_consent": False, "verified": False, 
            "has_referral": False, "staff": True, "dept_approval": True
        }) is True
        
        # Staff without department approval
        assert _evaluate_visibility(condition, {
            "age": 30, "parent_consent": False, "verified": False, 
            "has_referral": False, "staff": True, "dept_approval": False
        }) is False

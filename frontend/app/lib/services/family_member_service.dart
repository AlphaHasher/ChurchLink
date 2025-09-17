import '../helpers/api_client.dart';
import '../models/family_member.dart';

class FamilyMemberService {
  static Future<List<FamilyMember>> getFamilyMembers() async {
    try {
      final response = await api.get('/v1/users/all-family-members');
      if (response.data['success'] == true) {
        final List<dynamic> members = response.data['family_members'];
        return members.map((json) => FamilyMember.fromJson(json)).toList();
      }
      return [];
    } catch (e) {
      throw Exception('Failed to fetch family members: $e');
    }
  }

  static Future<FamilyMember?> addFamilyMember(
    FamilyMemberCreate member,
  ) async {
    try {
      final response = await api.post(
        '/v1/users/add-family-member',
        data: member.toJson(),
      );
      if (response.data['success'] == true) {
        return FamilyMember.fromJson(response.data['family_member']);
      }
      return null;
    } catch (e) {
      throw Exception('Failed to add family member: $e');
    }
  }

  static Future<bool> updateFamilyMember(
    String id,
    FamilyMemberCreate updates,
  ) async {
    try {
      final data = updates.toJson();
      data['id'] = id;

      final response = await api.patch('/v1/users/family-member', data: data);
      return response.data['success'] == true;
    } catch (e) {
      throw Exception('Failed to update family member: $e');
    }
  }

  static Future<bool> deleteFamilyMember(String id) async {
    try {
      final response = await api.delete('/v1/users/family-member/$id');
      return response.data['success'] == true;
    } catch (e) {
      throw Exception('Failed to delete family member: $e');
    }
  }
}

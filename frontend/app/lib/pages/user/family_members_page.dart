import 'package:flutter/material.dart';
import '../../models/family_member.dart';
import '../../services/family_member_service.dart';
import 'family_member_form.dart';

class FamilyMembersPage extends StatefulWidget {
  const FamilyMembersPage({super.key});

  @override
  State<FamilyMembersPage> createState() => _FamilyMembersPageState();
}

class _FamilyMembersPageState extends State<FamilyMembersPage> {
  List<FamilyMember> _familyMembers = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadFamilyMembers();
  }

  Future<void> _loadFamilyMembers() async {
    setState(() => _isLoading = true);
    try {
      final members = await FamilyMemberService.getFamilyMembers();
      setState(() {
        _familyMembers = members;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading family members: $e')),
        );
      }
    }
  }

  Future<void> _deleteFamilyMember(FamilyMember member) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: const Text('Delete Family Member'),
            content: Text(
              'Are you sure you want to delete ${member.fullName}?',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text(
                  'Delete',
                  style: TextStyle(color: Colors.red),
                ),
              ),
            ],
          ),
    );

    if (confirmed == true) {
      try {
        await FamilyMemberService.deleteFamilyMember(member.id);
        _loadFamilyMembers();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('${member.fullName} deleted successfully')),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error deleting family member: $e')),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text(
          'Family Members',
          style: TextStyle(color: Colors.white),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _loadFamilyMembers,
        child:
            _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _familyMembers.isEmpty
                ? const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.family_restroom, size: 64, color: Colors.grey),
                      SizedBox(height: 16),
                      Text(
                        'No family members yet',
                        style: TextStyle(fontSize: 18, color: Colors.grey),
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Tap the + button to add a family member',
                        style: TextStyle(color: Colors.grey),
                      ),
                    ],
                  ),
                )
                : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _familyMembers.length,
                  itemBuilder: (context, index) {
                    final member = _familyMembers[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: cs.primary,
                          child: Icon(
                            member.gender == 'M' ? Icons.male : Icons.female,
                            color: Colors.white,
                          ),
                        ),
                        title: Text(
                          member.fullName,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        subtitle: Text('Age: ${member.age}'),
                        trailing: PopupMenuButton(
                          itemBuilder:
                              (context) => [
                                const PopupMenuItem(
                                  value: 'edit',
                                  child: Row(
                                    children: [
                                      Icon(Icons.edit),
                                      SizedBox(width: 8),
                                      Text('Edit'),
                                    ],
                                  ),
                                ),
                                const PopupMenuItem(
                                  value: 'delete',
                                  child: Row(
                                    children: [
                                      Icon(Icons.delete, color: Colors.red),
                                      SizedBox(width: 8),
                                      Text(
                                        'Delete',
                                        style: TextStyle(color: Colors.red),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                          onSelected: (value) async {
                            if (value == 'edit') {
                              final result = await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder:
                                      (context) =>
                                          FamilyMemberForm(member: member),
                                ),
                              );
                              if (result == true) _loadFamilyMembers();
                            } else if (value == 'delete') {
                              _deleteFamilyMember(member);
                            }
                          },
                        ),
                      ),
                    );
                  },
                ),
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: cs.primary,
        onPressed: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const FamilyMemberForm()),
          );
          if (result == true) _loadFamilyMembers();
        },
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }
}

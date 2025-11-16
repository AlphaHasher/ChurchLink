import 'package:flutter/material.dart';
import 'package:app/models/family_member.dart';
import 'package:app/services/family_member_service.dart';
import 'package:app/pages/user/family_member_form.dart';
import 'package:app/helpers/localization_helper.dart';

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
        final fullError = 'Error loading family members: ${e.toString()}';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(LocalizationHelper.localize(fullError, capitalize: true))),
        );
      }
    }
  }

  Future<void> _deleteFamilyMember(FamilyMember member) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        final theme = Theme.of(dialogContext);
        return AlertDialog(
          title: Text(LocalizationHelper.localize('Delete Family Member')),
          content: Text(LocalizationHelper.localize('Are you sure you want to delete ${member.fullName}?')),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text(LocalizationHelper.localize('Cancel')),
            ),
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(
                LocalizationHelper.localize('Delete'),
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ),
          ],
        );
      },
    );

    if (confirmed == true) {
      try {
        await FamilyMemberService.deleteFamilyMember(member.id);
        _loadFamilyMembers();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(LocalizationHelper.localize('${member.fullName} deleted successfully'))),
          );
        }
      } catch (e) {
        if (mounted) {
          final fullError = 'Error deleting family member: ${e.toString()}';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(LocalizationHelper.localize(fullError, capitalize: true))),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(LocalizationHelper.localize('Family Members'))),
      body: RefreshIndicator(
        onRefresh: _loadFamilyMembers,
        child:
            _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _familyMembers.isEmpty
                ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.family_restroom,
                        size: 64,
                        color: theme.colorScheme.onSurface.withAlpha(50),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        LocalizationHelper.localize('No family members yet'),
                        style: TextStyle(
                          fontSize: 18,
                          color: theme.colorScheme.onSurface.withAlpha(60),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        LocalizationHelper.localize('Tap the + button to add a family member'),
                        style: TextStyle(
                          color: theme.colorScheme.onSurface.withAlpha(50),
                        ),
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
                          backgroundColor: theme.colorScheme.primary,
                          child: Text(
                            member.firstName.isNotEmpty
                                ? member.firstName[0].toUpperCase()
                                : '?',
                            style: TextStyle(
                              color: theme.colorScheme.onPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 20,
                            ),
                          ),
                        ),
                        title: Text(
                          member.fullName,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        subtitle: Text(LocalizationHelper.localize('Age: ${member.age}')),
                        trailing: PopupMenuButton(
                          itemBuilder:
                              (context) => [
                                PopupMenuItem(
                                  value: 'edit',
                                  child: Row(
                                    children: [
                                      Icon(Icons.edit),
                                      const SizedBox(width: 8),
                                      Text(LocalizationHelper.localize('Edit')),
                                    ],
                                  ),
                                ),
                                PopupMenuItem(
                                  value: 'delete',
                                  child: Row(
                                    children: [
                                      Icon(
                                        Icons.delete,
                                        color: theme.colorScheme.error,
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        LocalizationHelper.localize('Delete'),
                                        style: TextStyle(
                                          color: theme.colorScheme.error,
                                        ),
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
        backgroundColor: theme.colorScheme.primary,
        foregroundColor: theme.colorScheme.onPrimary,
        onPressed: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const FamilyMemberForm()),
          );
          if (result == true) _loadFamilyMembers();
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}

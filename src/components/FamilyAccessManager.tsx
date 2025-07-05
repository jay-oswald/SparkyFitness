
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Plus, Edit, Trash2, Calendar } from 'lucide-react';
import {
  loadFamilyAccess,
  createFamilyAccess,
  updateFamilyAccess,
  toggleFamilyAccessActiveStatus,
  deleteFamilyAccess,
  findUserByEmail,
  FamilyAccess,
} from '@/services/familyAccessService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';


const FamilyAccessManager = () => {
  const { user } = useAuth();
  const [familyAccess, setFamilyAccess] = useState<FamilyAccess[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccess, setEditingAccess] = useState<FamilyAccess | null>(null);
  const [formData, setFormData] = useState({
    family_email: '',
    calorie: false,
    checkin: false,
    reports: false,
    food_list: false,
    access_end_date: '',
  });

  useEffect(() => {
    const fetchFamilyAccess = async () => {
      if (!user) return;
      try {
        const data = await loadFamilyAccess(user.id);
        setFamilyAccess(data);
      } catch (error) {
        console.error('Error loading family access:', error);
        toast({
          title: "Error",
          description: "Failed to load family access records",
          variant: "destructive",
        });
      }
    };
    fetchFamilyAccess();
  }, [user]);

  const resetForm = () => {
    setFormData({
      family_email: '',
      calorie: false,
      checkin: false,
      reports: false,
      food_list: false,
      access_end_date: '',
    });
    setEditingAccess(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (access: FamilyAccess) => {
    setFormData({
      family_email: access.family_email,
      calorie: access.access_permissions.calorie,
      checkin: access.access_permissions.checkin,
      reports: access.access_permissions.reports,
      food_list: access.access_permissions.food_list,
      access_end_date: access.access_end_date ? access.access_end_date.split('T')[0] : '',
    });
    setEditingAccess(access);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !formData.family_email) return;

    // Check if at least one permission is selected
    if (!formData.calorie && !formData.checkin && !formData.reports && !formData.food_list) {
      toast({
        title: "Error",
        description: "Please select at least one permission",
        variant: "destructive",
      });
      return;
    }

    // Prevent adding yourself
    if (formData.family_email.toLowerCase() === user.email?.toLowerCase()) {
      toast({
        title: "Error",
        description: "You cannot grant access to yourself",
        variant: "destructive",
      });
      return;
    }

    try {
      
      const foundUserId = await findUserByEmail(formData.family_email);

      if (!editingAccess && foundUserId) {
        const existingAccess = familyAccess.find(
          (access) => access.owner_user_id === user.id && access.family_user_id === foundUserId
        );
        if (existingAccess) {
          toast({
            title: "Error",
            description: "Access already granted to this family member",
            variant: "destructive",
          });
          return;
        }
      }

      // For new access grants, we'll use a placeholder UUID if user not found
      // This allows the access to be created and activated later when the user signs up
      const familyUserId = foundUserId || '00000000-0000-0000-0000-000000000000';
      const status = foundUserId ? 'active' : 'pending';

      const accessData = {
        owner_user_id: user.id,
        family_user_id: familyUserId,
        family_email: formData.family_email,
        access_permissions: {
          calorie: formData.calorie,
          checkin: formData.checkin,
          reports: formData.reports,
          food_list: formData.food_list,
        },
        access_end_date: formData.access_end_date || null,
        status: status,
      };


      if (editingAccess) {
        // Update existing access
        await updateFamilyAccess(editingAccess.id, accessData);
        
        toast({
          title: "Success",
          description: "Family access updated successfully",
        });
      } else {
        // Create new access
        await createFamilyAccess(accessData);
        
        const statusMessage = foundUserId 
          ? "Family access granted successfully" 
          : `Access invitation sent to ${formData.family_email}. They'll have access once they create a SparkyFitness account.`;
        
        toast({
          title: "Success",
          description: statusMessage,
        });
      }

      setIsDialogOpen(false);
      resetForm();
      loadFamilyAccess();
    } catch (error) {
      console.error('Error saving family access:', error);
      toast({
        title: "Error",
        description: "Failed to save family access",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (access: FamilyAccess) => {
    try {
      await toggleFamilyAccessActiveStatus(access.id, !access.is_active);
      
      toast({
        title: "Success",
        description: `Family access ${!access.is_active ? 'activated' : 'deactivated'}`,
      });
      
      loadFamilyAccess();
    } catch (error) {
      console.error('Error toggling family access:', error);
      toast({
        title: "Error",
        description: "Failed to update family access",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (accessId: string) => {
    try {
      await deleteFamilyAccess(accessId);
      
      toast({
        title: "Success",
        description: "Family access removed successfully",
      });
      
      loadFamilyAccess();
    } catch (error) {
      console.error('Error deleting family access:', error);
      toast({
        title: "Error",
        description: "Failed to remove family access",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string, isActive: boolean) => {
    if (!isActive) {
      return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">Inactive</span>;
    }
    
    switch (status) {
      case 'active':
        return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Active</span>;
      case 'pending':
        return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">Pending</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">Unknown</span>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Family Access Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">
            Allow family members to manage your fitness data on your behalf.
          </p>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Family Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingAccess ? 'Edit' : 'Add'} Family Access
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="family_email">Family Member Email</Label>
                  <Input
                    id="family_email"
                    type="email"
                    value={formData.family_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, family_email: e.target.value }))}
                    placeholder="Enter family member's email"
                    disabled={!!editingAccess}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    They'll get access once they create a SparkyFitness account (if they don't have one already)
                  </p>
                </div>

                <Separator />

                <div>
                  <Label className="text-base font-medium">Access Permissions</Label>
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="calorie"
                        checked={formData.calorie}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, calorie: !!checked }))
                        }
                      />
                      <Label htmlFor="calorie">Manage Food Diary</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="food_list"
                        checked={formData.food_list}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, food_list: !!checked }))
                        }
                      />
                      <Label htmlFor="food_list">Food List (Read Only)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="checkin"
                        checked={formData.checkin}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, checkin: !!checked }))
                        }
                      />
                      <Label htmlFor="checkin">Check-in & Measurements</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="reports"
                        checked={formData.reports}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, reports: !!checked }))
                        }
                      />
                      <Label htmlFor="reports">Reports & Analytics</Label>
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="access_end_date">Access End Date (Optional)</Label>
                  <Input
                    id="access_end_date"
                    type="date"
                    value={formData.access_end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, access_end_date: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for indefinite access
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSubmit} className="flex-1">
                    {editingAccess ? 'Update' : 'Grant'} Access
                  </Button>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {familyAccess.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Family Member</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {familyAccess.map((access) => (
                <TableRow key={access.id}>
                  <TableCell>{access.family_email}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {access.access_permissions.calorie && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          Manage Food
                        </span>
                      )}
                      {access.access_permissions.food_list && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                          Food List
                        </span>
                      )}
                      {access.access_permissions.checkin && (
                        <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">
                          Check-in
                        </span>
                      )}
                      {access.access_permissions.reports && (
                        <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
                          Reports
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {access.access_end_date ? 
                      new Date(access.access_end_date).toLocaleDateString() : 
                      'No end date'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={access.is_active}
                        onCheckedChange={() => handleToggleActive(access)}
                      />
                      {getStatusBadge(access.status, access.is_active)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => openEditDialog(access)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDelete(access.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No family access granted yet</p>
            <p className="text-sm">Add family members to let them help manage your fitness data</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FamilyAccessManager;

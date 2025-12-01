const DataModel = require('./DataModel');
const deviceTypeData = require('./deviceTypeData');

class InventoryData extends DataModel {
    constructor() {
        super('inventory');
    }

    // Helper method to check if a device type is no-serial
    isNoSerialDeviceType(item) {
        if (!item.device || !item.device.type) {
            return false;
        }
        
        const deviceTypes = deviceTypeData.getAllItems();
        const deviceType = deviceTypes.find(dt => {
            const dtName = (dt.name || '').trim().toLowerCase();
            const itemTypeName = (item.device.type || '').trim().toLowerCase();
            return dtName === itemTypeName;
        });
        
        return deviceType ? (deviceType.noSerial === true) : false;
    }

    // Custom method to assign an inventory item
    assignItem(itemId, assignmentData) {
        const items = this.readData();
        const index = items.findIndex(item => item._id === itemId);
        
        if (index === -1) return null;

        const item = items[index];
        const isNoSerial = this.isNoSerialDeviceType(item);

        if (isNoSerial) {
            // Initialize arrays and inStock if not present (for existing items)
            item.userAssignments = item.userAssignments || [];
            item.projectAssignments = item.projectAssignments || [];
            if (item.inStock === undefined || item.inStock === null) {
                // Calculate inStock from total quantity minus all assignments
                const assignedToUsers = item.userAssignments.reduce((sum, a) => sum + (a.qty || 0), 0);
                const assignedToProjects = item.projectAssignments.reduce((sum, a) => sum + (a.qty || 0), 0);
                item.inStock = (item.quantity || 0) - assignedToUsers - assignedToProjects;
                if (item.inStock < 0) item.inStock = 0;
            }
            
            // Check if same project assignment exists, update it if so
            const existingAssignmentIndex = item.projectAssignments.findIndex(
                assignment => 
                    assignment.developer === assignmentData.developer &&
                    assignment.project === assignmentData.project &&
                    assignment.camera === assignmentData.camera
            );
            
            const assignmentQty = assignmentData.quantity || 1;
            
            // Check if we have enough in stock
            if (item.inStock < assignmentQty) {
                throw new Error(`Not enough stock available. Available: ${item.inStock}, Requested: ${assignmentQty}`);
            }
            
            if (existingAssignmentIndex >= 0) {
                // Update existing assignment quantity
                item.projectAssignments[existingAssignmentIndex].qty = 
                    (item.projectAssignments[existingAssignmentIndex].qty || 0) + assignmentQty;
            } else {
                // Add new assignment
                item.projectAssignments.push({
                    developer: assignmentData.developer,
                    project: assignmentData.project,
                    camera: assignmentData.camera,
                    qty: assignmentQty,
                    notes: assignmentData.notes,
                    assignedDate: new Date().toISOString()
                });
            }
            
            // Update inStock quantity
            item.inStock = item.inStock - assignmentQty;
            
            // Update status
            item.status = item.projectAssignments.length > 0 ? 'assigned' : 'available';
        } else {
            // For serialized devices: use the old structure (backward compatibility)
            if (item.currentAssignment) {
                item.assignmentHistory = item.assignmentHistory || [];
                item.assignmentHistory.push({
                    ...item.currentAssignment,
                    removedDate: new Date().toISOString(),
                    removalReason: 'Reassigned'
                });
            }
            
            item.currentAssignment = {
                ...assignmentData,
                assignedDate: new Date().toISOString()
            };
            item.status = 'assigned';
        }

        items[index] = item;
        this.writeData(items);
        return item;
    }

    assignItemtoUser(itemId, assignmentData) {
        const items = this.readData();
        const index = items.findIndex(item => item._id === itemId);
        
        if (index === -1) return null;

        const item = items[index];
        const isNoSerial = this.isNoSerialDeviceType(item);

        if (isNoSerial) {
            // Initialize arrays and inStock if not present (for existing items)
            item.userAssignments = item.userAssignments || [];
            item.projectAssignments = item.projectAssignments || [];
            if (item.inStock === undefined || item.inStock === null) {
                // Calculate inStock from total quantity minus all assignments
                const assignedToUsers = item.userAssignments.reduce((sum, a) => sum + (a.qty || 0), 0);
                const assignedToProjects = item.projectAssignments.reduce((sum, a) => sum + (a.qty || 0), 0);
                item.inStock = (item.quantity || 0) - assignedToUsers - assignedToProjects;
                if (item.inStock < 0) item.inStock = 0;
            }
            
            // Check if user already has an assignment, update it if so
            const existingAssignmentIndex = item.userAssignments.findIndex(
                assignment => assignment.userId === assignmentData.userId
            );
            
            const assignmentQty = assignmentData.quantity || 1;
            
            // Check if we have enough in stock
            if (item.inStock < assignmentQty) {
                throw new Error(`Not enough stock available. Available: ${item.inStock}, Requested: ${assignmentQty}`);
            }
            
            if (existingAssignmentIndex >= 0) {
                // Update existing assignment quantity
                item.userAssignments[existingAssignmentIndex].qty = 
                    (item.userAssignments[existingAssignmentIndex].qty || 0) + assignmentQty;
            } else {
                // Add new assignment
                item.userAssignments.push({
                    userId: assignmentData.userId,
                    userName: assignmentData.userName || '',
                    qty: assignmentQty,
                    assignedDate: new Date().toISOString()
                });
            }
            
            // Update inStock quantity
            item.inStock = item.inStock - assignmentQty;
            
            // Update status
            item.status = item.userAssignments.length > 0 ? 'user_assigned' : 'available';
        } else {
            // For serialized devices: use the old structure (backward compatibility)
            if (item.currentUserAssignment) {
                item.userAssignmentHistory = item.userAssignmentHistory || [];
                item.userAssignmentHistory.push({
                    ...item.currentUserAssignment,
                    removedDate: new Date().toISOString(),
                    removalReason: 'Reassigned To User'
                });
            }
            
            item.currentUserAssignment = {
                ...assignmentData,
                assignedDate: new Date().toISOString()
            };
            item.status = 'user_assigned';
        }

        items[index] = item;
        this.writeData(items);
        return item;
    }

    // Custom method to unassign an inventory item
    unassignItem(itemId, reason, projectData = null) {
        const items = this.readData();
        const index = items.findIndex(item => item._id === itemId);
        
        if (index === -1) return null;

        const item = items[index];
        const isNoSerial = this.isNoSerialDeviceType(item);

        if (isNoSerial) {
            // For no-serial devices: remove from projectAssignments array
            if (!item.projectAssignments || item.projectAssignments.length === 0) {
                return null;
            }

            if (projectData && projectData.developer && projectData.project && projectData.camera) {
                // Remove specific project assignment
                const assignmentIndex = item.projectAssignments.findIndex(
                    assignment => 
                        assignment.developer === projectData.developer &&
                        assignment.project === projectData.project &&
                        assignment.camera === projectData.camera
                );
                
                if (assignmentIndex >= 0) {
                    const assignment = item.projectAssignments[assignmentIndex];
                    const qtyToRemove = projectData.qty || assignment.qty || 1;
                    
                    // Update quantity or remove assignment
                    if (qtyToRemove >= (assignment.qty || 1)) {
                        // Remove entire assignment
                        item.projectAssignments.splice(assignmentIndex, 1);
                        item.inStock = (item.inStock || 0) + (assignment.qty || 1);
                    } else {
                        // Reduce quantity
                        assignment.qty = (assignment.qty || 1) - qtyToRemove;
                        item.inStock = (item.inStock || 0) + qtyToRemove;
                    }
                    
                    // Update status
                    item.status = item.projectAssignments.length > 0 ? 'assigned' : 'available';
                } else {
                    return null;
                }
            } else {
                // Remove all project assignments (for backward compatibility)
                const totalQty = item.projectAssignments.reduce((sum, a) => sum + (a.qty || 1), 0);
                item.inStock = (item.inStock || 0) + totalQty;
                item.projectAssignments = [];
                item.status = 'available';
            }
        } else {
            // For serialized devices: use the old structure
            if (!item.currentAssignment) return null;
            
            item.assignmentHistory = item.assignmentHistory || [];
            item.assignmentHistory.push({
                ...item.currentAssignment,
                removedDate: new Date().toISOString(),
                removalReason: reason
            });
            item.currentAssignment = null;
            item.status = 'available';
        }

        items[index] = item;
        this.writeData(items);
        return item;
    }

    // Custom method to unassign an inventory item
    unassignUserItem(itemId, reason, userId = null, qty = null) {
        const items = this.readData();
        const index = items.findIndex(item => item._id === itemId);
        
        if (index === -1) return null;

        const item = items[index];
        const isNoSerial = this.isNoSerialDeviceType(item);

        if (isNoSerial) {
            // For no-serial devices: remove from userAssignments array
            if (!item.userAssignments || item.userAssignments.length === 0) {
                return null;
            }

            if (userId) {
                // Remove specific user assignment
                const assignmentIndex = item.userAssignments.findIndex(
                    assignment => assignment.userId === userId
                );
                
                if (assignmentIndex >= 0) {
                    const assignment = item.userAssignments[assignmentIndex];
                    const qtyToRemove = qty || assignment.qty || 1;
                    
                    // Update quantity or remove assignment
                    if (qtyToRemove >= (assignment.qty || 1)) {
                        // Remove entire assignment
                        item.userAssignments.splice(assignmentIndex, 1);
                        item.inStock = (item.inStock || 0) + (assignment.qty || 1);
                    } else {
                        // Reduce quantity
                        assignment.qty = (assignment.qty || 1) - qtyToRemove;
                        item.inStock = (item.inStock || 0) + qtyToRemove;
                    }
                    
                    // Update status
                    item.status = item.userAssignments.length > 0 ? 'user_assigned' : 'available';
                } else {
                    return null;
                }
            } else {
                // Remove all user assignments (for backward compatibility)
                const totalQty = item.userAssignments.reduce((sum, a) => sum + (a.qty || 1), 0);
                item.inStock = (item.inStock || 0) + totalQty;
                item.userAssignments = [];
                item.status = 'available';
            }
        } else {
            // For serialized devices: use the old structure
            if (!item.currentUserAssignment) return null;
            
            item.userAssignmentHistory = item.userAssignmentHistory || [];
            item.userAssignmentHistory.push({
                ...item.currentUserAssignment,
                removedDate: new Date().toISOString(),
                removalReason: reason
            });
            item.currentUserAssignment = null;
            item.status = 'available';
        }

        items[index] = item;
        this.writeData(items);
        return item;
    }



    // Get items assigned to a developer
    getItemsByDeveloperId(developerId) {
        const items = this.readData();
        return items.filter(item => 
            item.currentAssignment && 
            item.currentAssignment.developer._id === developerId
        );
    }

    // Get items assigned to a project
    getItemsByProjectId(projectId) {
        const items = this.readData();
        return items.filter(item => 
            item.currentAssignment && 
            item.currentAssignment.project._id === projectId
        );
    }

    // Get items assigned to a project
    getItemsBySerial(serial) {
        const items = this.readData();
        return items.filter(item => 
           item.device.serialNumber === serial
        );
    }


     // Get items assigned to a user
    getItemsByUserId(userId) {
        const items = this.readData();
        return items.filter(item => 
            item.currentUserAssignment && 
            item.currentUserAssignment.userId === userId
        );
    }
    
}

module.exports = new InventoryData();
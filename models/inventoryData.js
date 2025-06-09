const DataModel = require('./DataModel');

class InventoryData extends DataModel {
    constructor() {
        super('inventory');
    }

    // Custom method to assign an inventory item
    assignItem(itemId, assignmentData) {
        const items = this.readData();
        const index = items.findIndex(item => item._id === itemId);
        
        if (index === -1) return null;

        // If currently assigned, move to history
        if (items[index].currentAssignment) {
            items[index].assignmentHistory = items[index].assignmentHistory || [];
            items[index].assignmentHistory.push({
                ...items[index].currentAssignment,
                removedDate: new Date().toISOString(),
                removalReason: 'Reassigned'
            });
        }

        // Create new assignment
        const updatedItem = {
            ...items[index],
            currentAssignment: {
                ...assignmentData,
                assignedDate: new Date().toISOString()
            },
            status: 'assigned'
        };

        items[index] = updatedItem;
        this.writeData(items);
        return updatedItem;
    }

    assignItemtoUser(itemId, assignmentData) {
        const items = this.readData();
        const index = items.findIndex(item => item._id === itemId);
        
        if (index === -1) return null;

        // If currently assigned, move to history
        if (items[index].currentUserAssignment) {
            items[index].userAssignmentHistory = items[index].userAssignmentHistory || [];
            items[index].userAssignmentHistory.push({
                ...items[index].currentAssignment,
                removedDate: new Date().toISOString(),
                removalReason: 'Reassigned To User'
            });
        }

        // Create new assignment
        const updatedItem = {
            ...items[index],
            currentUserAssignment: {
                ...assignmentData,
                assignedDate: new Date().toISOString()
            },
            status: 'user_assigned'
        };

        items[index] = updatedItem;
        this.writeData(items);
        return updatedItem;
    }

    // Custom method to unassign an inventory item
    unassignItem(itemId, reason) {
        const items = this.readData();
        const index = items.findIndex(item => item._id === itemId);
        
        if (index === -1 || !items[index].currentAssignment) return null;

        // Move current assignment to history
        const updatedItem = {
            ...items[index],
            assignmentHistory: [
                ...(items[index].assignmentHistory || []),
                {
                    ...items[index].currentAssignment,
                    removedDate: new Date().toISOString(),
                    removalReason: reason
                }
            ],
            currentAssignment: null,
            status: 'available'
        };

        items[index] = updatedItem;
        this.writeData(items);
        return updatedItem;
    }

    // Custom method to unassign an inventory item
    unassignUserItem(itemId, reason) {
        const items = this.readData();
        const index = items.findIndex(item => item._id === itemId);
        
        if (index === -1 || !items[index].currentUserAssignment) return null;

        // Move current assignment to history
        const updatedItem = {
            ...items[index],
            userAssignmentHistory: [
                ...(items[index].userAssignmentHistory || []),
                {
                    ...items[index].currentUserAssignment,
                    removedDate: new Date().toISOString(),
                    removalReason: reason
                }
            ],
            currentUserAssignment: null,
            status: 'available'
        };

        items[index] = updatedItem;
        this.writeData(items);
        return updatedItem;
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
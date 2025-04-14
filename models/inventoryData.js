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
}

module.exports = new InventoryData();
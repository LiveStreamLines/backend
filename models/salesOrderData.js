const DataModel = require('./DataModel');
const logger = require('../logger');

class SalesOrderData extends DataModel {
    constructor() {
        super('salesOrders');
    }

    // Override addItem to include sales order specific fields
    addItem(item) {
        const items = this.readData();
        const newItem = {
            _id: this.generateCustomId(),
            orderNumber: this.generateOrderNumber(),
            ...item,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        items.push(newItem);
        this.writeData(items);
        logger.info(`Created new sales order: ${newItem.orderNumber}`);
        return newItem;
    }

    // Override updateItem to include updatedAt timestamp
    updateItem(id, updateData) {
        const items = this.readData();
        const index = items.findIndex(item => item._id === id);
        
        if (index !== -1) {
            items[index] = {
                ...items[index],
                ...updateData,
                updatedAt: new Date().toISOString()
            };
            this.writeData(items);
            logger.info(`Updated sales order: ${items[index].orderNumber}`);
            return items[index];
        }
        return null;
    }

    // Override deleteItem to include logging
    deleteItem(id) {
        const items = this.readData();
        const itemToDelete = items.find(item => item._id === id);
        
        if (itemToDelete) {
            const success = super.deleteItem(id);
            if (success) {
                logger.info(`Deleted sales order: ${itemToDelete.orderNumber}`);
            }
            return success;
        }
        return false;
    }

    // Sales order specific methods
    getItemsByCustomer(customerId) {
        const items = this.readData();
        return items.filter(item => item.customerId === customerId);
    }

    generateOrderNumber() {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `SO-${year}${month}-${random}`;
    }
}

module.exports = new SalesOrderData(); 
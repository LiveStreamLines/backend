const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

class SalesOrderData {
    constructor() {
        this.dataPath = path.join(__dirname, '../data/salesOrders.json');
        this.ensureDataFile();
    }

    ensureDataFile() {
        if (!fs.existsSync(this.dataPath)) {
            fs.writeFileSync(this.dataPath, '[]');
            logger.info('Created salesOrders.json file');
        }
    }

    getAllItems() {
        try {
            const data = fs.readFileSync(this.dataPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            logger.error('Error reading sales orders:', error);
            return [];
        }
    }

    getItemById(id) {
        const items = this.getAllItems();
        return items.find(item => item._id === id);
    }

    addItem(item) {
        try {
            const items = this.getAllItems();
            const newItem = {
                _id: uuidv4(),
                orderNumber: this.generateOrderNumber(),
                ...item,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            items.push(newItem);
            this.saveItems(items);
            logger.info(`Created new sales order: ${newItem.orderNumber}`);
            return newItem;
        } catch (error) {
            logger.error('Error adding sales order:', error);
            throw error;
        }
    }

    updateItem(id, updateData) {
        try {
            const items = this.getAllItems();
            const index = items.findIndex(item => item._id === id);
            if (index === -1) return null;

            items[index] = {
                ...items[index],
                ...updateData,
                updatedAt: new Date().toISOString()
            };

            this.saveItems(items);
            logger.info(`Updated sales order: ${items[index].orderNumber}`);
            return items[index];
        } catch (error) {
            logger.error('Error updating sales order:', error);
            throw error;
        }
    }

    deleteItem(id) {
        try {
            const items = this.getAllItems();
            const index = items.findIndex(item => item._id === id);
            if (index === -1) return false;

            const deletedItem = items[index];
            items.splice(index, 1);
            this.saveItems(items);
            logger.info(`Deleted sales order: ${deletedItem.orderNumber}`);
            return true;
        } catch (error) {
            logger.error('Error deleting sales order:', error);
            throw error;
        }
    }

    getItemsByCustomer(customerId) {
        const items = this.getAllItems();
        return items.filter(item => item.customerId === customerId);
    }

    generateOrderNumber() {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `SO-${year}${month}-${random}`;
    }

    saveItems(items) {
        fs.writeFileSync(this.dataPath, JSON.stringify(items, null, 2));
    }
}

module.exports = new SalesOrderData(); 
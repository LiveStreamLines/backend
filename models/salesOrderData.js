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
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const yearMonth = `${year}-${month}`;
        
        const items = this.readData();
        
        // Find the highest serial number for this year-month combination
        let maxSerial = 0;
        items.forEach(item => {
            if (item.orderNumber) {
                const match = item.orderNumber.match(new RegExp(`^SO-${year}-${month}-(\\d{4})$`));
                if (match) {
                    const serial = parseInt(match[1], 10);
                    if (serial > maxSerial) {
                        maxSerial = serial;
                    }
                }
            }
        });
        
        // Generate next serial number (0001 to 9999)
        const nextSerial = Math.min(maxSerial + 1, 9999);
        const serialStr = nextSerial.toString().padStart(4, '0');
        
        const orderNumber = `SO-${year}-${month}-${serialStr}`;
        logger.info(`Generated order number: ${orderNumber} (serial: ${serialStr})`);
        return orderNumber;
    }

    generateInvoiceNumber() {
        const items = this.readData();
        const currentYear = new Date().getFullYear();
        
        // Find the highest invoice sequence number across all sales orders
        let maxSequence = 0;
        
        items.forEach(salesOrder => {
            if (salesOrder.invoices && Array.isArray(salesOrder.invoices)) {
                salesOrder.invoices.forEach(invoice => {
                    if (invoice.invoiceSequence && invoice.invoiceSequence > maxSequence) {
                        maxSequence = invoice.invoiceSequence;
                    }
                });
            }
        });
        
        // Generate next sequence number
        const nextSequence = maxSequence + 1;
        const invoiceNumber = `INV-${currentYear}-${nextSequence.toString().padStart(4, '0')}`;
        
        logger.info(`Generated invoice number: ${invoiceNumber} (sequence: ${nextSequence})`);
        return invoiceNumber;
    }
}

module.exports = new SalesOrderData(); 
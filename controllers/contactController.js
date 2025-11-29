const contactData = require('../models/contactData');
const logger = require('../logger');

// Controller for getting all contacts
function getAllContacts(req, res) {
    try {
        const { developerId, projectId, cameraId } = req.query;
        
        let contacts;
        if (cameraId) {
            contacts = contactData.getContactsByCamera(cameraId);
        } else if (projectId) {
            contacts = contactData.getContactsByProject(projectId);
        } else if (developerId) {
            contacts = contactData.getAllContactsByDeveloper(developerId);
        } else {
            contacts = contactData.getAllItems();
        }
        
        res.json(contacts);
    } catch (error) {
        logger.error('Error getting contacts', error);
        res.status(500).json({ message: 'Failed to get contacts' });
    }
}

// Controller for getting a single contact by ID
function getContactById(req, res) {
    try {
        const contact = contactData.getItemById(req.params.id);
        if (contact) {
            res.json(contact);
        } else {
            res.status(404).json({ message: 'Contact not found' });
        }
    } catch (error) {
        logger.error('Error getting contact', error);
        res.status(500).json({ message: 'Failed to get contact' });
    }
}

// Controller for adding a new contact
function addContact(req, res) {
    try {
        const { name, phone, email, company, designation, notes, developerId, projectId, cameraId } = req.body;

        // Validation
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Contact name is required' });
        }

        // At least one association is required
        if (!developerId && !projectId && !cameraId) {
            return res.status(400).json({ message: 'Contact must be associated with a developer, project, or camera' });
        }

        // If cameraId is provided, projectId and developerId should be inferred or validated
        // If projectId is provided, developerId should be inferred or validated
        // For now, we'll allow any combination and let the frontend handle validation

        const payload = {
            name: name.trim(),
            phone: phone || '',
            email: email || '',
            company: company || '',
            designation: designation || '',
            notes: notes || '',
            developerId: developerId || null,
            projectId: projectId || null,
            cameraId: cameraId || null,
        };

        const addedContact = contactData.addItem(payload);
        return res.status(201).json(addedContact);
    } catch (error) {
        logger.error('Error adding contact', error);
        return res.status(500).json({ message: 'Failed to add contact' });
    }
}

// Controller for updating a contact
function updateContact(req, res) {
    try {
        const contactId = req.params.id;
        const { name, phone, email, company, designation, notes, developerId, projectId, cameraId } = req.body;

        // Validation
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'Contact name is required' });
        }

        // At least one association is required
        if (!developerId && !projectId && !cameraId) {
            return res.status(400).json({ message: 'Contact must be associated with a developer, project, or camera' });
        }

        const updatedData = {
            name: name.trim(),
            phone: phone || '',
            email: email || '',
            company: company || '',
            designation: designation || '',
            notes: notes || '',
            developerId: developerId || null,
            projectId: projectId || null,
            cameraId: cameraId || null,
        };

        const updatedContact = contactData.updateItem(contactId, updatedData);

        if (!updatedContact) {
            return res.status(404).json({ message: 'Contact not found' });
        }

        return res.json(updatedContact);
    } catch (error) {
        logger.error('Error updating contact', error);
        return res.status(500).json({ message: 'Failed to update contact' });
    }
}

// Controller for deleting a contact
function deleteContact(req, res) {
    try {
        const isDeleted = contactData.deleteItem(req.params.id);
        if (isDeleted) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'Contact not found' });
        }
    } catch (error) {
        logger.error('Error deleting contact', error);
        res.status(500).json({ message: 'Failed to delete contact' });
    }
}

module.exports = {
    getAllContacts,
    getContactById,
    addContact,
    updateContact,
    deleteContact
};


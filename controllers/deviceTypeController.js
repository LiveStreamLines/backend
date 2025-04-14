const DeviceTypeData = require('../models/deviceTypeData');

exports.getDeviceType = (req, res) => {
  res.json(DeviceTypeData.getAllItems());
};

exports.getDeviceTypebyId = (req, res) => {
    const devicetype = DeviceTypeData.getItemById(req.params.id);
    if (devicetype) {
        res.json(devicetype);
    } else {
        res.status(404).josn({message: 'memory not found'});
    }
};

exports.addDeviceType = (req, res) => {
  const newDeviceType = DeviceTypeData.addItem(req.body);
  res.status(201).json(newDeviceType);
};

exports.updatedDeviceType = (req, res) => {
    const updatedDeviceType = DeviceTypeData.updateItem(req.params.id, req.body);
    if (updatedDeviceType) {
        res.json(updatedDeviceType);
    } else {
        res.status(404).json({ message: 'Memory Not Updated'});
    }

};
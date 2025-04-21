const MemoryData = require('../models/memoryData');

exports.getMemories = (req, res) => {
  res.json(MemoryData.getAllItems());
};

exports.getMemorybyId = (req, res) => {
    const memory = MemoryData.getItemById(req.params.id);
    if (memory) {
        res.json(memory);
    } else {
        res.status(404).josn({message: 'memory not found'});
    }
};

exports.getMemoryByInfo = (req, res) => {
    const { developer, project, camera } = req.body;
    const memory = MemoryData.findMemory(developer, project, camera);
    if (memory && memory.length > 0) {
        res.json({result: memory[0]._id});
    } else {
        res.json({ result: "False"});
    }
}

exports.addMemory = (req, res) => {
  const newMemory = MemoryData.addItem(req.body);
  res.status(201).json(newMemory);
};

exports.updateMemory = (req, res) => {
    const updatedMemory = MemoryData.updateItem(req.params.id, req.body);
    if (updatedMemory) {
        res.json(updatedMemory);
    } else {
        res.status(404).json({ message: 'Memory Not Updated'});
    }

};
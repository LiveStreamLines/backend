const DataModel = require('./DataModel');

class MemoryData extends DataModel {
    constructor() {
        super('memories');
    }

    
    findMemory(developer, project, camera) {
        const memories = this.readData();
        return memories.filter(memory =>
            memory.developer === developer && memory.project === project &&
            memory.camera === camera && memory.status === 'active'
        );   
    }   
}

module.exports = new MemoryData();
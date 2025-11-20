const DataModel = require('./DataModel');

class CameraStatusHistoryData extends DataModel {
  constructor() {
    super('cameraStatusHistory');
  }

  getByCameraId(cameraId) {
    const entries = this.readData();
    return entries.filter((entry) => entry.cameraId === cameraId);
  }
}

module.exports = new CameraStatusHistoryData();


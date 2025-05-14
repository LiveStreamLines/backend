const DataModel = require('./DataModel');

class UserData extends DataModel {
    constructor() {
        super('users');
    }

     findUserByEmailAndPassword(email, password) {
        const data = this.readData();
        return data.find(user => user.email.toLowerCase() === email.toLowerCase() && user.password === password);
    }

    findUserByPhone(phone) {
        const data = this.readData();
        return data.find(user => user.phone === phone);
    }

     getUserByEmail(email) {
        const data = this.readData();
        return data.filter(item => item.email.toLowerCase() === email.toLowerCase());
    }

    getUserByToken(token) {
        const data = this.readData();
        return data.filter(item => item.resetPasswordToken === token);
    }
}

module.exports = new UserData();
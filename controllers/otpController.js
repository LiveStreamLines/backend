const jwt = require('jsonwebtoken');
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const operationusersData = require('../models/operationusersData');
const usersData = require('../models/usersData');
const logger = require('../logger');

// Generate and Send OTP
exports.sendOtp = (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  // Validate Twilio Service SID is configured
  if (!process.env.TWILIO_SERVICE_SID) {
    logger.error('TWILIO_SERVICE_SID environment variable is not set');
    return res.status(500).json({ error: 'Twilio service configuration is missing' });
  }

  const user = usersData.findUserByPhone(phone);

  if (user && !user.isActive) {
      return res.status(403).json({ msg: 'User account is inactive' });
  }

  client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
    .verifications.create({ to: phone, channel: 'sms', locale: 'en' })
    .then(() => {
      res.status(200).json({ message: 'OTP sent successfully' });
    })
    .catch((err) => {
      logger.error('Error sending OTP:', err);
      
      // Provide more specific error messages
      if (err.code === 20404) {
        return res.status(404).json({ 
          error: 'Twilio Verify Service not found. Please check your TWILIO_SERVICE_SID environment variable.',
          details: `Service SID: ${process.env.TWILIO_SERVICE_SID}`,
          message: 'The Twilio Verify Service does not exist or has been deleted. Please verify the service SID in your Twilio console.'
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to send OTP',
        message: err.message || 'An unknown error occurred'
      });
    });
}

// Verify OTP
exports.verifyOtp = (req, res) => {
  const { phone, otp, userId } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required' });
  }

  // Validate Twilio Service SID is configured
  if (!process.env.TWILIO_SERVICE_SID) {
    logger.error('TWILIO_SERVICE_SID environment variable is not set');
    return res.status(500).json({ error: 'Twilio service configuration is missing' });
  }

  client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
    .verificationChecks.create({ to: phone, code: otp })
    .then((verificationCheck) => {
      if (verificationCheck.status === 'approved') {
        let user;
        if (userId) {
            // If userId is provided, associate the phone with the user
            user = usersData.getItemById(userId);
            if (user) {
                user.phone = phone; // Associate the phone number
                user.status = "active";
                usersData.updateItem(userId, user); // Save updated user data
            }
        } else {
            // For phone login, find user by phone
            user = usersData.findUserByPhone(phone);
        }

        if (!user) {
            return res.status(401).json({ msg: 'User not found' });
        }

        if (!user.isActive) {
            return res.status(403).json({ msg: 'User account is inactive' });
        }

        // Generate a JWT token with expiration (24 hours)
        const authToken = jwt.sign(
          { phone: user.phone, role: user.role },
          'secretKey',
          { expiresIn: '24h' } // Token expires in 24 hours
        );

          // Extract IDs for authorized developers and projects from the user object
          // const developerIds = user.accessibleDevelopers || [];
          // const projectIds = user.accessibleProjects || [];
          // const cameraIds = user.accessibleCameras || [];
          // const services = user.accessibleServices || [];

          const logintime = new Date().toISOString();
          const updatedUser = usersData.updateItem(user._id, {"LastLoginTime":logintime});
          

          return res.json({ 
            ... user,
            authh: authToken
          });

          // return res.json({
          //   authh: authToken,
          //   username: user.name,
          //   email: user.email,
          //   phone: user.phone,
          //   role: user.role,
          //   developers: developerIds,
          //   projects: projectIds,
          //   cameras: cameraIds,
          //   services: services,
          //   canAdduser: user.canAddUser,
          //   canGenerateVideoAndPics: user.canGenerateVideoAndPics
          // });
       
      } else {
        return res.status(401).json({ error: 'Invalid OTP' });
      }
    })
    .catch((err) => {
      logger.error('Error verifying OTP:', err);
      
      // Provide more specific error messages
      if (err.code === 20404) {
        return res.status(404).json({ 
          error: 'Twilio Verify Service not found. Please check your TWILIO_SERVICE_SID environment variable.',
          details: `Service SID: ${process.env.TWILIO_SERVICE_SID}`,
          message: 'The Twilio Verify Service does not exist or has been deleted. Please verify the service SID in your Twilio console.'
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to verify OTP',
        message: err.message || 'An unknown error occurred'
      });
    });
};

const jwt = require('jsonwebtoken');
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const userData = require('../models/userData'); // Import user data module

// Generate and Send OTP
exports.sendOtp = (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  const user = userData.findUserByPhone(phone);

  if (user && !user.isActive) {
      return res.status(403).json({ msg: 'User account is inactive' });
  }

  client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
    .verifications.create({ to: phone, channel: 'sms', locale: 'en' })
    .then(() => {
      res.status(200).json({ message: 'OTP sent successfully' });
    })
    .catch((err) => {
      console.error('Error sending OTP:', err);
      res.status(500).json({ error: 'Failed to send OTP' });
    });
}

// Verify OTP
exports.verifyOtp = (req, res) => {
  const { phone, otp, userId } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required' });
  }

  client.verify.v2.services(process.env.TWILIO_SERVICE_SID)
    .verificationChecks.create({ to: phone, code: otp })
    .then((verificationCheck) => {
      if (verificationCheck.status === 'approved') {
        let user;
        if (userId) {
            // If userId is provided, associate the phone with the user
            user = userData.getItemById(userId);
            if (user) {
                user.phone = phone; // Associate the phone number
                userData.updateItem(userId, user); // Save updated user data
            }
        } else {
            // For phone login, find user by phone
            user = userData.findUserByPhone(phone);
        }

        if (!user) {
            return res.status(401).json({ msg: 'User not found' });
        }

        if (!user.isActive) {
            return res.status(403).json({ msg: 'User account is inactive' });
        }

        // Generate a JWT token
        const authToken = jwt.sign(
          { phone: user.phone, role: user.role },
          'secretKey'
        );

          // Extract IDs for authorized developers and projects from the user object
          const developerIds = user.accessibleDevelopers || [];
          const projectIds = user.accessibleProjects || [];
          const cameraIds = user.accessibleCameras || [];
          const services = user.accessibleServices || [];

          return res.json({
            authh: authToken,
            username: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            developers: developerIds,
            projects: projectIds,
            cameras: cameraIds,
            services: services,
            canAdduser: user.canAddUser,
            canGenerateVideoAndPics: user.canGenerateVideoAndPics
          });
       
      } else {
        return res.status(401).json({ error: 'Invalid OTP' });
      }
    })
    .catch((err) => {
      console.error('Error verifying OTP:', err);
      res.status(500).json({ error: 'Failed to verify OTP' });
    });
};

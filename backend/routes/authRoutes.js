const express = require('express');
const router = express.Router();
const { register, login, getProfile, updateProfile } = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const { validate, authValidators } = require('../middleware/validator');

router.post('/register', validate(authValidators.register), register);
router.post('/login', validate(authValidators.login), login);
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, updateProfile);

module.exports = router;
const express = require('express');
const router = express.Router();
const {getAllUserName,getUserProfile,updateUser}=require('../controllers/userController');
router.get('/nameId',getAllUserName);// /user/nameId
router.get('/profile',getUserProfile);
router.post('/update',updateUser);
module.exports = router;
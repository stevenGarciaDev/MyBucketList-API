const { User, validate } = require("../models/user");
const bcrypt = require('bcrypt');
const _ = require('lodash');
const config = require('config');
const mongoose = require("mongoose");
const express = require("express");
const router = express.Router();
const auth = require('../middleware/auth');
const { BucketList } = require("../models/bucketList");
const { Friendship } = require("../models/friendship");
const { MessageGroup } = require("../models/messageGroup");
const { Post } = require("../models/post");
const { TaskGroup } = require("../models/taskgroup");
const crypto =require( 'crypto');
const nodemailer = require('nodemailer');
const Sequelize =require( 'sequelize');
const Op = Sequelize.Op;
require('dotenv').config();


// get a user,
// read from JSON web tokens; req.user._id
router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  if (!user) return res.status(404).send("User not found");

  res.send(user);
});

// Register a new user
router.post("/", async (req, res) => {
  const { error } = validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  let user = await User.findOne({ email: req.body.email });
  if (user) return res.status(400).send('User already registered');

  user = new User( _.pick(req.body, ['name', 'email', 'password']) );
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(user.password, salt);
  await user.save();

  const newList = new BucketList();
  newList.owner = user._id;
  await newList.save();

  const userFriends = new Friendship();
  userFriends.owner = user._id;
  await userFriends.save();

  const token = user.generateAuthToken();
  res
    .header('x-auth-token', token)
    .header("access-control-expose-headers", "x-auth-token")
    .send({
      name: user.name,
      email: user.email,
      _id: user._id,
    });
});

router.post('/settingDetail/:user_id', async (req, res) => {
  const { detailName, value } = req.body;

  const user = await User.findById(req.params.user_id);

  console.log(user[detailName]);

  user[detailName] = value;
  await user.save();



  //const userss = await User.findById(req.params.user_id);
  //console.log(userss[detailName]);
  res.send(user);
});




router.get('/settingInfo/:user_id', async (req, res) => {
 // const { detailName, value } = req.body;

  const user = await User.findById(req.params.user_id);
  const info =  {
    name: user["name"],
    email: user["email"],
    isPrivate: user["isPrivateProfile"],
    isActive: user["isActiveAccount"],
  };
  //const userss = await User.findById(req.params.user_id);

  res.send(info);
});



router.get('/publicUsers', async (req, res) => {
  const users = await User.find({ isPrivateProfile: false });
  console.log('Users are', users);
  res.send(users);
});

// Get public user by ID
router.get('/publicUsers/:id', async (req, res) => {
  const users = await User.find({ _id: req.params.id, isPrivateProfile: false })
  .select('name');
  res.send(users);
});

// get User by id
router.get('/retrieveUser/:id', async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  res.send(user);
});

router.get('/retrieveUserbyEmail/:id', async (req, res) => {
  const user = await User.findOne({email:req.params.id});

  res.send(user);
});

router.get('/retrieveUserId/:name', async (req, res) => {
  try {
    const regex = new RegExp(`^${req.params.name}$`, 'i');
    const user = await User.find({ name: regex });
    res.send(user);
  } catch (ex) {
    console.log("unable to retrieve name", ex);
  }
});


// update User's profile image
router.post('/updateProfileImage', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.photo = req.body.image;
    //console.log(`photo is ${user.photo}`);
    await user.save();
    return user;
  } catch (ex) {
    console.log("unable to upload profile image");
  }
});

router.post('/updateBio/:user_id', async (req, res) => {
  try {
    const user = await User.findById(req.params.user_id);
    console.log("user is ", user);
    user.bio = req.body.bioText;
    const res = await user.save();
    console.log("res is ", res);
    return user;
  } catch (e) {
    console.log("Unable to upload bio", e);
  }
});

router.put('/updateProfile/:user_id', async (req, res) => {
  // receive uploaded image and bio

  try {
    //console.log(req.body.bioText);

     await User.collection.updateOne({email: req.params.user_id}, {$set: {bio: req.body.bioText}});


    //console.log(req.params.user_id);

    //console.log(User.getUsers());
 } catch (e) {
    //print(e);
 }
   const users = await User.find( {email: req.params.user_id} , { bio: 1} );

  //console.log(lsl);
  res.send(users);
});




router.put('/updatePhoto/:user_id', async (req, res) => {


  try {


     await User.collection.updateOne({email: req.params.user_id}, {$set: {photo: req.body.photo}});


    console.log(req.body.photo);
    //console.log(User.getUsers());
 } catch (e) {
    //print(e);
 }
   const users = await User.find( {email: req.params.user_id} , { photo: 1} );

  //console.log(lsl);
  res.send(users);
});



router.post('/forgotPassword', async (req,  res)=> {
  if (req.body.email === '') {
    res.status(400).send('email required');
  }
  let user = await User.findOne({ email: req.body.email });
  if (user) {
    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    await user.save();
    user.reserPasswordExpires= Date.now() + 360000;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth:{
        user: `${process.env.GMAILID}`,
        pass: `${process.env.GMAILPW}`
      },
    });
    const mailOptions = {
      from: 'list.phuket@gmail.com',
      to: `${user.email}`,
      subject: 'Link To Reset Password',
      text:
        'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n'
        + 'Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\n'
        + `https://bucket-list-items.herokuapp.com/reset/${token}\n\n`
        + 'If you did not request this, please ignore this email and your password will remain unchanged.\n',
    };
    console.log('sending mail');

    transporter.sendMail(mailOptions, (err, response) => {
      if (err) {
        console.error('there was an error: ', err);
      } else {

        res.status(200).json('recovery email sent');
      }
    });
  }
  else{
    res.send("email not Found");
  }
});

router.put('/updatePassword',async(req,res)=>{
  let user = await User.findOne({email: req.body.params.params.email});
  if(user){
    user.password = req.body.params.params.data.Password;
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    await user.save();
    res.send("Password changed");
    console.log("password changed");
  }
  else{
    res.send("User not found");
  }
});

router.put('/matchPassword',async(req,res)=>{
  try {
    let user = await User.findOne({_id: req.body.userId});
    if(user){
      const validPassword = await bcrypt.compare(req.body.oldPass, user.password);
      if(validPassword){
        const salt = await bcrypt.genSalt(10);
        user.password = req.body.newPass;
        user.password = await bcrypt.hash(user.password, salt);
        await user.save();
        res.send(true);
        console.log("password changed");
      }
      else{
        console.log("password failed to change: old password did not match");
        res.send(false);
      }
    }
    else{
      console.log("password failed to change: user could not be found");
      res.send(false);
    }
  } catch (e) {
    console.log("error: failed to update user password.", e);
  }
});

router.put('/confirmPassword',async(req,res)=>{
  try {
    let user = await User.findOne({_id: req.body.user});
    if(user){
      const validPassword = await bcrypt.compare(req.body.confirmPass, user.password);
      console.log(user.password);
      if(validPassword){
        res.send(true);
        console.log("password match");
      }
      else{
        console.log("password did not match");
        res.send(false);
      }
    }
    else{
      console.log("User Not found");
      res.send(false);
    }
  } catch (e) {
    console.log("error:.", e);
  }
});

router.get('/resetPassword',async (req, res) => {
  let user =await  User.findOne({resetPasswordToken: req.query.token});
  if(user){
    res.status(200).send({
      email: user.email,
      message: 'password reset link a-ok',
    });
  }
  else{
     console.error('password reset link is invalid or has expired');
      res.status(403).send('password reset link is invalid or has expired');
  }
});


router.get('/UserBio/:user_id', async (req, res) => {
  //const users = await User.find( {email: req.params.user_id} , { bio: 1} );
  const users = await User.find( {email: req.params.user_id},  { bio: 1}  );
  //console.log(lsl);
  res.send(users);
});


router.get('/UserPhoto/:user_id', async (req, res) => {

  const users = await User.find( {email: req.params.user_id},  { photo: 1}  );

  res.send(users);
});

router.get('/UserProfilePhoto/:user_id', async (req, res) => {

  try {
    const response = await User.find( {_id: req.params.user_id}, { photo: 1}  );
    res.send(response);
  } catch (ex) {
    console.log("Could not retrieve user profile photo: " + ex);
  }

});

// Get public user name and privacy status
router.get('/user/basic/:id', async (req, res) => {
  try {
    const data = await User.findById(req.params.id)
    .select('name isPrivateProfile bio photo');
  res.send(data);
  } catch (ex) {
    console.log("Cannot retrieve user information." + ex);
  }
});

router.get('/UserProfileBio/:user_id', async (req, res) => {
  try {
    const response = await User.find( {_id: req.params.user_id}, { bio: 1}  );
    res.send(response);
  } catch (ex) {
    console.log("Could not retrieve user profile bio: " + ex);
  }
});


router.delete('/removeUser/:user_id', async (req, res) => {
  try {
    // remove the User's post
    const postResponse = await Post.deleteMany({ author: req.params.user_id });

    // remove the User's comments
    // $pull is used to remove an element from an array (subdocument)
    // and remove the User's likes on Posts
    const posts = await Post.updateMany({},
      {$pull: {"comments": { "author": req.params.user_id }} },
      {$pull: {"likes": req.params.user_id }}
    );

    // remove the User's bucket list
    const bucketList = await BucketList.deleteOne({ owner: req.params.user_id });

    // remove the User from their MessageGroups
    // and their associated messages
    let msgGroups = await MessageGroup.updateMany({},
      {$pull: {"members": req.params.user_id }}
    );

    let userMsgGroups = await MessageGroup.updateMany({},
      {$pull: {"messages": { "sender": req.params.user_id }} }
    );
    console.log("userMsgGroups!", userMsgGroups);

    // remove from User's friends list
    const friendsList = await Friendship.updateMany({},
      {$pull: {"friends": { "userid": req.params.user_id }}}
    );

    // remove User from TaskGroups
    const taskGroups = await TaskGroup.updateMany({},
      {$pull: {"groupMembers": req.params.user_id }}
    );

    // remove the User
    const response = await User.deleteOne({ _id: req.params.user_id });
    console.log("response", response);

    res.send(response);
  } catch (ex) {
    console.log("Could not remove user ");
  }
});

router.get('/privacy/:user_id', async (req, res) => {
  try {
    const response = await User.findOne( {_id: req.params.user_id}, { isPrivateProfile: 1, _id: 0});

    console.log(response);

    res.send(response);
  } catch (e) {
    console.log("error: ", e);
  }
});


module.exports = router;

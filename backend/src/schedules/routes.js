const express=require('express'),service=require('./service');
const publicRouter=express.Router(),internalRouter=express.Router();
const ok=(res,data,status=200)=>res.status(status).json({success:true,data});
publicRouter.get('/',async(req,res)=>ok(res,await service.list(req.owner)));
publicRouter.post('/',async(req,res)=>ok(res,await service.create(req.owner,req.body),201));
publicRouter.patch('/:id',async(req,res)=>ok(res,await service.setEnabled(req.owner,req.params.id,req.body?.enabled)));
internalRouter.post('/dispatch',async(req,res)=>{
 const user=await require('../auth/internal').activeUser(process.env.INTERNAL_RESEARCH_USER_ID);
 if(!user)throw Object.assign(new Error('Active internal research owner required'),{status:503});
 if(req.get('Idempotency-Key')!==req.body?.scheduleId+':'+req.body?.windowKey)throw Object.assign(new Error('Use canonical schedule window Idempotency-Key'),{status:400});
 ok(res,await service.dispatch(user.id,req.body),202);
});
module.exports={publicRouter,internalRouter};

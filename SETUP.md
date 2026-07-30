# ข้อมูลสำคัญ กฟจ.นครพนม — Setup Guide

## 1. ตั้งค่า Google Apps Script

1. เปิด Google Sheet: https://docs.google.com/spreadsheets/d/13n2T_ZH7K-av4hRa1Q1iHLoyn-GV-XeeQ9m3mxUnT_8
2. ไปที่ **ส่วนขยาย > Apps Script**
3. ลบโค้ดเดิม แล้ววางโค้ดจากไฟล์ `google-apps-script/Code.gs`
4. **แก้ไข** `LINE_CHANNEL_SECRET` ใส่ค่า Channel Secret จาก LINE Developers Console
5. กด **ทำให้ใช้งานได้ > การทำให้ใช้งานได้ใหม่**
   - ประเภท: **เว็บแอป**
   - ดำเนินการในฐานะ: **ตัวฉัน**
   - ผู้ที่มีสิทธิ์เข้าถึง: **ทุกคน**
6. คัดลอก **URL ของเว็บแอป** ที่ได้

## 2. ใส่ Apps Script URL ในเว็บ

แก้ไฟล์ `public/index.html` บรรทัด:
```js
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL';
```
เปลี่ยนเป็น URL ที่ได้จากขั้นตอนที่ 1

## 3. ตั้งค่า LINE Login

ใน LINE Developers Console:
- **Callback URL**: `https://your-domain.vercel.app/callback.html`

## 4. Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```
หรือเชื่อมต่อ GitHub repo กับ Vercel

## 5. จัดการสิทธิ์ผู้ใช้

เปิด Google Sheet → แท็บ **users**
- คอลัมน์ **Active**: เปลี่ยนเป็น `YES` เพื่ออนุมัติ, `NO` เพื่อระงับ
- ผู้ใช้ใหม่จะถูกเพิ่มอัตโนมัติเมื่อล็อกอินครั้งแรก (default = NO)

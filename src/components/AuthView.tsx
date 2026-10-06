/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { User, Phone, Lock, Eye, EyeOff, Sparkles } from 'lucide-react';
import { User as UserType, SystemSettings } from '../types';
import { getStoredData } from '../db/local_db';
import { generateUniqueAccountId } from '../db/account_id_service';
import { SephoraLogo } from './SephoraLogo';

interface AuthViewProps {
  settings: SystemSettings;
  users: UserType[];
  onLoginSuccess: (user: UserType) => void;
  onRegisterSuccess: (newUser: UserType) => void;
  currentTab: string;
  onNavigate: (tab: string) => void;
}

export default function AuthView({ settings, users, onLoginSuccess, onRegisterSuccess, onNavigate }: AuthViewProps) {
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerRole, setRegisterRole] = useState<'Customer' | 'Merchant'>('Customer');
  
  // Local flags
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');

  const themePrimary = settings.themeColor || '#FF1E27';
  const themeGradientEnd = settings.themeGradientEnd || '#FF5E62';

  // Format phone to digit-only with 10 digit constraint
  const handlePhoneChange = (val: string) => {
    if (authMode === 'login') {
      // Allow any character (such as emails for admin accounts)
      setPhone(val);
    } else {
      const digits = val.replace(/\D/g, '').slice(0, 10);
      setPhone(digits);
    }
    setErrorText('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    
    const isNumericPhone = /^\d+$/.test(phone);
    if (isNumericPhone && phone.length !== 10) {
      setErrorText('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (10 หลัก)');
      return;
    }
    if (password.length < 8) {
      setErrorText('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }

    // Lookup user in absolutely latest centralized database
    const latestUsers = getStoredData<UserType[]>("paopao_users", users);
    const foundUser = latestUsers.find(u => u.phone === phone);
    if (!foundUser) {
      setErrorText('ไม่พบข้อมูลบัญชีผู้ใช้นี้ในระบบ หรือรหัสผ่านไม่ถูกต้อง');
      return;
    }

    if (foundUser.password !== password) {
      setErrorText('ไม่พบข้อมูลบัญชีผู้ใช้นี้ในระบบ หรือรหัสผ่านไม่ถูกต้อง');
      return;
    }

    // Role penalties check
    if (foundUser.status === 'suspended') {
      setErrorText('บัญชีคุณถูกอายัดโปรดติดต่อฝ่ายบริการลูกค้า');
      alert('บัญชีคุณถูกอายัดโปรดติดต่อฝ่ายบริการลูกค้า');
      return;
    }

    if (foundUser.status === 'banned') {
      setErrorText('คุณถูกแบนผู้ติดต่อ ฝ่ายบริการลูกค้า');
      alert('คุณถูกแบนผู้ติดต่อ ฝ่ายบริการลูกค้า');
      return;
    }

    // Succeeded
    setSuccessText('เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับกลับมา');
    setTimeout(() => {
      onLoginSuccess(foundUser);
    }, 800);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setSuccessText('');

    if (!name.trim()) {
      setErrorText('กรุณากรอกชื่อ-นามสกุลจริง');
      return;
    }
    if (phone.length !== 10) {
      setErrorText('กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก');
      return;
    }
    if (password.length < 8) {
      setErrorText('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (password !== confirmPassword) {
      setErrorText('การยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    // Get absolutely latest database to verify uniqueness safely
    const latestUsers = getStoredData<UserType[]>("paopao_users", users);
    const exists = latestUsers.some(u => u.phone === phone);
    if (exists) {
      setErrorText('เบอร์โทรศัพท์นี้สมัครสมาชิกแล้ว');
      return;
    }

    // Allocate guaranteed unique account ID checked against the database
    const newId = await generateUniqueAccountId(registerRole, latestUsers);

    const newUser: UserType = {
      id: newId,
      name: name.trim(),
      phone,
      password,
      role: registerRole,
      status: 'active',
      wallet: 0, // initially 0
      avatar: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${name}`,
      isOrderEnabled: registerRole === 'Merchant' ? false : true,
      createdAt: new Date().toISOString(),
    };

    setSuccessText('สมัครสมาชิกสำเร็จเรียบร้อยแล้ว!');
    setTimeout(() => {
      onRegisterSuccess(newUser);
    }, 1000);
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setSuccessText('');

    const exists = users.find(u => u.phone === phone);
    if (!exists) {
      setErrorText('ไม่พบเบอร์โทรศัพท์นี้ในระบบ');
      return;
    }

    setSuccessText(`ดำเนินการกู้คืนแล้ว: รหัสผ่านของคุณคือ [ ${exists.password} ] โปรดจดจำรหัสผ่านนี้`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-8 animate-fade-in bg-slate-50/50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 p-8">
        
        {/* Branding Logo */}
        <div className="flex flex-col items-center text-center mb-8">
          {settings.siteIcon || settings.siteLogo ? (
            <img 
              src={settings.siteIcon || settings.siteLogo} 
              alt="Website Icon" 
              className="w-20 h-20 object-contain rounded-2xl bg-white border border-gray-150 shadow-md p-1 mb-4"
              referrerPolicy="no-referrer"
            />
          ) : (
            <SephoraLogo className="w-20 h-20 mb-4" />
          )}
          <h1 className="text-3xl font-black mt-2 leading-none tracking-tight text-gray-900">
            {settings.siteName || 'Sephora Thailand'}
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1 uppercase tracking-wider">
            {authMode === 'login' ? 'เข้าสู่ระบบร้านค้าและลูกค้า' : authMode === 'register' ? 'สมัครสมาชิกบัญชีผู้ซื้อ' : 'ลืมรหัสผ่านใช่ไหม?'}
          </p>
        </div>

        {/* Feedback Cards */}
        {errorText && (
          <div id="auth-err-msg" className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold border border-rose-100 text-center">
            {errorText}
          </div>
        )}
        {successText && (
          <div id="auth-succ-msg" className="mb-4 p-3 rounded-xl bg-teal-50 text-teal-600 text-xs font-bold border border-teal-100 text-center">
            {successText}
          </div>
        )}

        {/* Forms Switcher */}
        {authMode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600">เบอร์โทรศัพท์ (10 ตัวเลขเท่านั้น)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <Phone size={16} />
                </span>
                <input
                  id="login-phone"
                  type="text"
                  placeholder="เช่น 0991234567"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-semibold focus:outline-none focus:border-red-500 transition-colors"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <label className="text-xs font-bold text-gray-600">รหัสผ่าน (8 ตัวขึ้นไป)</label>
                <button
                  type="button"
                  id="forgot-password-link"
                  onClick={() => { setAuthMode('forgot'); setErrorText(''); setSuccessText(''); }}
                  className="text-xs font-bold text-red-500 hover:underline"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <Lock size={16} />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="ป้อนรหัสผ่านของคุณ"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-11 pr-11 text-sm font-semibold focus:outline-none focus:border-red-500 transition-colors"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              className="w-full py-3.5 rounded-2xl text-sm font-black text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-95"
              style={{ background: `linear-gradient(135deg, ${themePrimary} 0%, ${themeGradientEnd} 100%)` }}
            >
              เข้าสู่ระบบปลอดภัย
            </button>

            <div className="text-center mt-6">
              <span className="text-xs font-medium text-gray-400">ยังไม่เป็นสมาชิกใช่ไหม? </span>
              <button
                type="button"
                id="go-register-btn"
                onClick={() => { setAuthMode('register'); setErrorText(''); setSuccessText(''); setPhone(''); setPassword(''); }}
                className="text-xs font-bold text-red-500 hover:underline"
              >
                สมัครสมาชิกฟรีที่นี่
              </button>
            </div>
          </form>
        )}

        {authMode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Fullname */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600">ชื่อ - นามสกุลจริง</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <User size={16} />
                </span>
                <input
                  id="register-name"
                  type="text"
                  placeholder="เช่น มะลิ หอมเกสร"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-semibold focus:outline-none focus:border-red-500 transition-colors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600">เบอร์โทรศัพท์มือถือ (10 หลัก)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <Phone size={16} />
                </span>
                <input
                  id="register-phone"
                  type="text"
                  placeholder="เช่น 0991234567"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-semibold focus:outline-none focus:border-red-500 transition-colors"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600">รหัสผ่าน (8 ตัวขึ้นไป)</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <Lock size={16} />
                </span>
                <input
                  id="register-password"
                  type="password"
                  placeholder="ตั้งรหัสผ่านที่รัดกุม"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-semibold focus:outline-none focus:border-red-500 transition-colors"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600">ยืนยันรหัสผ่านอีกครั้ง</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <Lock size={16} />
                </span>
                <input
                  id="register-confirm-password"
                  type="password"
                  placeholder="พิมพ์ถอดรหัสของท่านอีกครั้ง"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-semibold focus:outline-none focus:border-red-500 transition-colors"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              id="register-submit-btn"
              type="submit"
              className="w-full py-3.5 rounded-2xl text-sm font-black text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-95"
              style={{ background: `linear-gradient(135deg, ${themePrimary} 0%, ${themeGradientEnd} 100%)` }}
            >
              สมัครสมาชิก และใช้บริการซื้อของฟรี
            </button>

            <div className="text-center mt-6">
              <span className="text-xs font-medium text-gray-400">เป็นสมาชิกอยู่แล้วเก๋าเกมส์? </span>
              <button
                type="button"
                id="go-login-btn"
                onClick={() => { setAuthMode('login'); setErrorText(''); setSuccessText(''); setPhone(''); setPassword(''); }}
                className="text-xs font-bold text-red-500 hover:underline"
              >
                เข้าสู่ระบบเลยที่นี่
              </button>
            </div>
          </form>
        )}

        {authMode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-xs text-gray-500 text-center mb-4">
              กรอกเบอร์โทรศัพท์ของคุณที่ใช้สมัคร เพื่อตรวจสอบข้อมูลรหัสความปลอดภัยเดิมในฐานข้อมูล SEPHORA THAILAND
            </p>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-600">เบอร์โทรศัพท์ 10 หลัก</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
                  <Phone size={16} />
                </span>
                <input
                  id="forgot-phone"
                  type="text"
                  placeholder="เบอร์โทรของท่าน"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-semibold focus:outline-none focus:border-red-500 transition-colors"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                />
              </div>
            </div>

            <button
              id="forgot-submit-btn"
              type="submit"
              className="w-full py-3.5 rounded-2xl text-sm font-black text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-95"
              style={{ background: `linear-gradient(135deg, ${themePrimary} 0%, ${themeGradientEnd} 100%)` }}
            >
              ค้นหารหัสผ่านเดิมของฉัน
            </button>

            <div className="text-center mt-6">
              <button
                type="button"
                id="go-back-login-btn"
                onClick={() => { setAuthMode('login'); setErrorText(''); setSuccessText(''); }}
                className="text-xs font-bold text-gray-500 hover:underline"
              >
                ย้อนกลับไปหน้าล็อกอิน
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

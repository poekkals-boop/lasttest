import React, { useState, useEffect } from 'react';

export const THAI_BANKS = [
  {
    id: "kbank",
    name: "ธนาคารกสิกรไทย",
    englishName: "Kasikornbank (KBank)",
    color: "#00A950",
    textColor: "#ffffff",
    shortName: "KBANK",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.kasikornbank.com&size=128"
  },
  {
    id: "scb",
    name: "ธนาคารไทยพาณิชย์",
    englishName: "Siam Commercial Bank (SCB)",
    color: "#4E2A84",
    textColor: "#ffffff",
    shortName: "SCB",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.scb.co.th&size=128"
  },
  {
    id: "bbl",
    name: "ธนาคารกรุงเทพ",
    englishName: "Bangkok Bank (BBL)",
    color: "#003399",
    textColor: "#ffffff",
    shortName: "BBL",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.bangkokbank.com&size=128"
  },
  {
    id: "ktb",
    name: "ธนาคารกรุงไทย",
    englishName: "Krungthai Bank (KTB)",
    color: "#00A2E5",
    textColor: "#ffffff",
    shortName: "KTB",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://krungthai.com&size=128"
  },
  {
    id: "krungsri",
    name: "ธนาคารกรุงศรีอยุธยา",
    englishName: "Bank of Ayudhya (Krungsri)",
    color: "#FEC425",
    textColor: "#000000",
    shortName: "BAY",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.krungsri.com&size=128"
  },
  {
    id: "gsb",
    name: "ธนาคารออมสิน",
    englishName: "Government Savings Bank (GSB)",
    color: "#EC068C",
    textColor: "#ffffff",
    shortName: "GSB",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.gsb.or.th&size=128"
  },
  {
    id: "ttb",
    name: "ธนาคารทหารไทยธนชาต",
    englishName: "TMBThanachart Bank (ttb)",
    color: "#0047BA",
    textColor: "#ffffff",
    shortName: "TTB",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.ttbbank.com&size=128"
  },
  {
    id: "baac",
    name: "ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร",
    englishName: "Bank for Agriculture and Agricultural Cooperatives (BAAC)",
    color: "#006C35",
    textColor: "#ffffff",
    shortName: "BAAC",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.baac.or.th&size=128"
  },
  {
    id: "uob",
    name: "ธนาคารยูโอบี",
    englishName: "United Overseas Bank (UOB)",
    color: "#0B2A4A",
    textColor: "#ffffff",
    shortName: "UOB",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.uob.co.th&size=128"
  },
  {
    id: "ghb",
    name: "ธนาคารอาคารสงเคราะห์",
    englishName: "Government Housing Bank (GHB)",
    color: "#FF6600",
    textColor: "#ffffff",
    shortName: "GHB",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.ghbank.co.th&size=128"
  },
  {
    id: "kkp",
    name: "ธนาคารเกียรตินาคินภัทร",
    englishName: "Kiatnakin Phatra Bank (KKP)",
    color: "#5E17EB",
    textColor: "#ffffff",
    shortName: "KKP",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.kkpfg.com&size=128"
  },
  {
    id: "cimb",
    name: "ธนาคารซีไอเอ็มบีไทย",
    englishName: "CIMB Thai Bank",
    color: "#8C0305",
    textColor: "#ffffff",
    shortName: "CIMB",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.cimbthai.com&size=128"
  },
  {
    id: "lhb",
    name: "ธนาคารแลนด์ แอนด์ เฮ้าส์",
    englishName: "Land and Houses Bank (LH Bank)",
    color: "#00508F",
    textColor: "#ffffff",
    shortName: "LHBANK",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.lhbank.co.th&size=128"
  },
  {
    id: "tcrb",
    name: "ธนาคารไทยเครดิต",
    englishName: "Thai Credit Bank",
    color: "#1B3E6C",
    textColor: "#ffffff",
    shortName: "TCRB",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.thaicreditbank.com&size=128"
  },
  {
    id: "icbc",
    name: "ธนาคารไอซีบีซี (ไทย)",
    englishName: "ICBC (Thai)",
    color: "#C30D23",
    textColor: "#ffffff",
    shortName: "ICBC",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.icbc.com.cn&size=128"
  },
  {
    id: "boc",
    name: "ธนาคารแห่งประเทศจีน (ไทย)",
    englishName: "Bank of China (Thai)",
    color: "#B31B1B",
    textColor: "#ffffff",
    shortName: "BOC",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.bankofchina.co.th&size=128"
  },
  {
    id: "exim",
    name: "ธนาคารเพื่อการส่งออกและนำเข้าแห่งประเทศไทย",
    englishName: "Export-Import Bank of Thailand (EXIM)",
    color: "#0054A6",
    textColor: "#ffffff",
    shortName: "EXIM",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.exim.go.th&size=128"
  },
  {
    id: "sme",
    name: "ธนาคารพัฒนาวิสาหกิจขนาดกลางและขนาดย่อมแห่งประเทศไทย",
    englishName: "SME Development Bank of Thailand",
    color: "#004B87",
    textColor: "#ffffff",
    shortName: "SMED",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.smebank.co.th&size=128"
  },
  {
    id: "ibank",
    name: "ธนาคารอิสลามแห่งประเทศไทย",
    englishName: "Islamic Bank of Thailand (iBank)",
    color: "#006B54",
    textColor: "#ffffff",
    shortName: "IBANK",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.ibank.co.th&size=128"
  },
  {
    id: "bot",
    name: "ธนาคารแห่งประเทศไทย",
    englishName: "Bank of Thailand (BOT)",
    color: "#003366",
    textColor: "#ffffff",
    shortName: "BOT",
    logo: "https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://www.bot.or.th&size=128"
  }
];

export function BankLogo({ bank, className = "w-6 h-6" }: { bank: typeof THAI_BANKS[0], className?: string }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [bank.id, bank.logo]);
  
  if (imgError || !bank.logo) {
    return (
      <div 
        className={`${className} flex items-center justify-center rounded-full text-[9px] font-bold text-white uppercase shadow-xs shrink-0`}
        style={{ backgroundColor: bank.color }}
      >
        {bank.shortName.substring(0, 2)}
      </div>
    );
  }
  
  return (
    <img 
      src={bank.logo} 
      alt={bank.name} 
      className={`${className} object-contain rounded bg-white p-0.5 border border-gray-150 shadow-xs shrink-0`}
      referrerPolicy="no-referrer"
      onError={() => setImgError(true)}
    />
  );
}

export const findBank = (name: string) => {
  if (!name) return undefined;
  return THAI_BANKS.find(b => 
    b.name === name || 
    b.englishName === name || 
    b.shortName === name || 
    name.toLowerCase().includes(b.shortName.toLowerCase()) || 
    b.name.includes(name)
  );
};

export const renderSelectedBankInfo = (name: string) => {
  const matched = findBank(name);
  if (matched) {
    return (
      <div className="flex items-center gap-2">
        <BankLogo bank={matched} className="w-5 h-5" />
        <span className="text-xs font-bold text-gray-800">{matched.name}</span>
      </div>
    );
  }
  return <span className="text-xs font-bold text-gray-800">{name || 'เลือกธนาคาร'}</span>;
};

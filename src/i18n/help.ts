/**
 * Plain, step-by-step help. Short sentences and the same button names the app shows,
 * so someone who reads slowly can follow along with the screen.
 */
export const helpEn = {
  nav: "Help",
  title: "How to use Khamar Khata",
  subtitle: "Step by step, with the same button names you see in the app. For 2 cows or 2,000.",
  loginTitle: "How to sign in",
  login: [
    "Type your mobile number, for example 01712-345678. Then press “Send code”.",
    "An SMS comes to your phone with a 6-digit code.",
    "Type the code and press “Verify and continue”.",
    "The first time, write your farm's name and district. Your farm is ready.",
  ],
  loginTips: [
    "Never tell anyone your code. Nobody from Khamar Khata will ask for it.",
    "No SMS? Wait one minute, then press “Send a new code”.",
    "You can type numbers in Bangla (০১৭…) or English (017…).",
  ],
  demoTip: "On this demo site no SMS is sent. The code shows on the screen.",
  moreHelp: "More help, step by step",
  contents: "On this page",
  stepWord: "Step {n}",
  sections: [
    {
      id: "animal",
      title: "Add a cow or bull",
      steps: [
        "Open “Animals”, then press “Add animal”.",
        "Write the ear tag number. If there is no tag, give a number of your own, like 1, 2, 3.",
        "Choose cow or bull, the breed, and the birth date (a guess is fine).",
        "Press “Save animal”. To add a photo, open the animal and press “Add photo”. The phone camera opens. Take the photo from the side, in daylight.",
      ],
    },
    {
      id: "milk",
      title: "Write today's milk",
      steps: [
        "Open “Dairy”, then “Record milk”.",
        "Choose “Morning” or “Evening”.",
        "Write the litres next to each cow. Leave it blank if she wasn't milked.",
        "Press “Save milking”. With no internet, it stays on the phone and sends itself later.",
      ],
    },
    {
      id: "health",
      title: "Write a vaccine or treatment",
      steps: [
        "Open “Health”, then “Vaccinate a group” or “Record treatment”.",
        "Pick the vaccine or medicine, and tick the animals.",
        "Write the cost if you paid. It goes into your expenses by itself.",
        "If the medicine has a withdrawal time, the app keeps that animal's milk or meat out of sale until it ends.",
      ],
    },
    {
      id: "breeding",
      title: "Heat, AI and calving",
      steps: [
        "Open “Breeding”, then “Record an event”.",
        "Choose heat, service (AI or bull), pregnancy check, dry-off or calving.",
        "Write the cow's tag and the date. For a calving, write the calf's tag too.",
        "The calendar then shows the next dates. These are estimates; check with your vet.",
      ],
    },
    {
      id: "qurbani",
      title: "Weigh Qurbani bulls",
      steps: [
        "Open “Qurbani”, then “Weigh-in”.",
        "Write the scale weight. No scale? Measure around the chest and the body length with a tape, and the app works out the weight.",
        "Weigh every 2 to 4 weeks. The app shows which bull is behind for Eid.",
      ],
    },
    {
      id: "sell",
      title: "Sell on the cattle market",
      steps: [
        "Open “Marketplace”, press “List an animal”, and choose the animal to sell.",
        "Write a price and a few lines about the animal.",
        "Buyers see its weight, milk and vaccines from your records. Your number stays hidden.",
        "When a buyer sends a question, it shows in your inbox. You call them back.",
      ],
    },
    {
      id: "team",
      title: "Add a worker or vet",
      steps: [
        "Open “Team”. Under “Invite someone”, write their number.",
        "Choose a role: manager, worker or vet. Press “Send invite”, and tell them yourself.",
        "They sign in with their own number. A worker can write milk, weights and heat, but can't see money.",
      ],
    },
  ],
  installTitle: "Put it on your phone like an app",
  install: [
    { os: "Android (Chrome)", steps: ["Open the site in Chrome.", "Press ⋮ at the top right.", "Press “Add to Home screen” or “Install app”.", "A Khamar Khata icon appears with your other apps."] },
    { os: "iPhone (Safari)", steps: ["Open the site in Safari.", "Press the Share button (a square with an arrow).", "Press “Add to Home Screen”, then “Add”.", "Open it from the new icon. It opens full screen, like an app."] },
  ],
  sizesTitle: "Small farm or big farm",
  sizes: [
    "2 or 3 cows: add them, write milk once a day if you like, and keep vaccine dates. Nothing else is needed.",
    "A big farm: add sheds, give each worker their own login, and download records for your accountant.",
  ],
  stuckTitle: "Stuck?",
  stuck: "Press the back arrow to go back. Nothing is lost: everything you saved stays saved. Ask your vet or a family member to look with you, and show them this page.",
  language: "Change language any time with the বাংলা / English button at the top.",
};

export type HelpDict = typeof helpEn;

export const helpBn: HelpDict = {
  nav: "সাহায্য",
  title: "খামার খাতা কীভাবে চালাবেন",
  subtitle: "ধাপে ধাপে, অ্যাপে যে বোতাম দেখবেন সেই নামেই। ২টি গরু হোক বা ২০০০টি।",
  loginTitle: "কীভাবে ঢুকবেন",
  login: [
    "আপনার মোবাইল নম্বর লিখুন, যেমন ০১৭১২-৩৪৫৬৭৮। তারপর “কোড পাঠান” চাপুন।",
    "আপনার ফোনে একটি এসএমএস আসবে। তাতে ৬টি সংখ্যার একটি কোড থাকবে।",
    "কোডটি লিখে “যাচাই করে এগিয়ে যান” চাপুন।",
    "প্রথমবার হলে খামারের নাম আর জেলা লিখুন। আপনার খামার তৈরি।",
  ],
  loginTips: [
    "কোড কাউকে বলবেন না। খামার খাতার কেউ কখনো কোড চাইবে না।",
    "এসএমএস আসেনি? এক মিনিট অপেক্ষা করে “নতুন কোড পাঠান” চাপুন।",
    "নম্বর বাংলায় (০১৭…) বা ইংরেজিতে (017…), দুইভাবেই লেখা যায়।",
  ],
  demoTip: "এই ডেমো সাইটে এসএমএস যায় না। কোড পর্দাতেই দেখাবে।",
  moreHelp: "আরও সাহায্য, ধাপে ধাপে",
  contents: "এই পাতায় যা আছে",
  stepWord: "ধাপ {n}",
  sections: [
    {
      id: "animal",
      title: "গরু বা ষাঁড় যোগ করুন",
      steps: [
        "“পশু” খুলুন, তারপর “পশু যোগ করুন” চাপুন।",
        "কানের ট্যাগের নম্বর লিখুন। ট্যাগ না থাকলে নিজের মতো নম্বর দিন, যেমন ১, ২, ৩।",
        "গাভী না ষাঁড়, জাত আর জন্মতারিখ বাছুন (আন্দাজে দিলেও চলবে)।",
        "“সংরক্ষণ করুন” চাপুন। ছবি দিতে পশুটি খুলে “ছবি তুলুন” চাপুন। ফোনের ক্যামেরা খুলবে। দিনের আলোয়, পাশ থেকে ছবি তুলুন।",
      ],
    },
    {
      id: "milk",
      title: "আজকের দুধ লিখুন",
      steps: [
        "“দুধ” খুলুন, তারপর “দুধ লিখুন”।",
        "“সকাল” বা “বিকাল” বাছুন।",
        "প্রতিটি গাভীর পাশে লিটার লিখুন। দোয়ানো না হলে ঘর খালি রাখুন।",
        "“দোহন সংরক্ষণ” চাপুন। নেট না থাকলে ফোনে থেকে যায়, নেট এলে নিজেই চলে যায়।",
      ],
    },
    {
      id: "health",
      title: "টিকা বা চিকিৎসা লিখুন",
      steps: [
        "“স্বাস্থ্য” খুলুন, তারপর “দলে টিকা” বা “চিকিৎসা লিখুন”।",
        "টিকা বা ওষুধ বাছুন, আর পশুগুলোতে টিক দিন।",
        "টাকা খরচ হলে লিখুন। তা নিজে থেকেই খরচের হিসাবে যোগ হবে।",
        "ওষুধের পর কিছুদিন দুধ বা মাংস বিক্রি নিষেধ থাকলে, সেই কদিন অ্যাপ ওই পশুকে বিক্রির বাইরে রাখে।",
      ],
    },
    {
      id: "breeding",
      title: "গরম, কৃত্রিম প্রজনন আর বাচ্চা দেওয়া",
      steps: [
        "“প্রজনন” খুলুন, তারপর “ঘটনা লিখুন”।",
        "গরম, প্রজনন (সিমেন বা ষাঁড়), গর্ভ পরীক্ষা, দুধ বন্ধ বা বাচ্চা দেওয়া বাছুন।",
        "গাভীর ট্যাগ আর তারিখ লিখুন। বাচ্চা হলে বাছুরের ট্যাগও লিখুন।",
        "তারপর ক্যালেন্ডারে পরের তারিখগুলো দেখাবে। এগুলো আনুমানিক; ডাক্তারের সাথে মিলিয়ে নিন।",
      ],
    },
    {
      id: "qurbani",
      title: "কোরবানির ষাঁড়ের ওজন",
      steps: [
        "“কোরবানি” খুলুন, তারপর “ওজন নিন”।",
        "পাল্লার ওজন লিখুন। পাল্লা নেই? ফিতা দিয়ে বুকের বেড় আর শরীরের লম্বা মাপুন, অ্যাপ ওজন হিসাব করে দেবে।",
        "২ থেকে ৪ সপ্তাহ পরপর ওজন নিন। কোন ষাঁড় ঈদের লক্ষ্যে পিছিয়ে, অ্যাপ দেখিয়ে দেবে।",
      ],
    },
    {
      id: "sell",
      title: "গরুর হাটে বিক্রি",
      steps: [
        "“বাজার” খুলুন, “বিজ্ঞাপন দিন” চাপুন, আর বিক্রির পশুটি বাছুন।",
        "দাম আর পশুটি সম্পর্কে কয়েক লাইন লিখুন।",
        "ক্রেতা আপনার খাতা থেকে ওজন, দুধ আর টিকার তথ্য দেখবে। আপনার নম্বর গোপন থাকবে।",
        "ক্রেতা প্রশ্ন পাঠালে আপনার ইনবক্সে আসবে। আপনি তাকে ফোন করবেন।",
      ],
    },
    {
      id: "team",
      title: "কর্মী বা ডাক্তার যোগ করুন",
      steps: [
        "“টিম” খুলুন। “কাউকে আমন্ত্রণ জানান” এর নিচে তার নম্বর লিখুন।",
        "ভূমিকা বাছুন: ম্যানেজার, কর্মী বা ডাক্তার। “আমন্ত্রণ পাঠান” চাপুন, আর তাকে নিজে জানিয়ে দিন।",
        "সে নিজের নম্বর দিয়ে ঢুকবে। কর্মী দুধ, ওজন আর গরম লিখতে পারে, কিন্তু টাকার হিসাব দেখতে পায় না।",
      ],
    },
  ],
  installTitle: "ফোনে অ্যাপের মতো রাখুন",
  install: [
    { os: "অ্যান্ড্রয়েড (Chrome)", steps: ["Chrome-এ সাইটটি খুলুন।", "উপরে ডানদিকে ⋮ চাপুন।", "“Add to Home screen” বা “Install app” চাপুন।", "অন্য অ্যাপগুলোর সাথে খামার খাতার আইকন চলে আসবে।"] },
    { os: "আইফোন (Safari)", steps: ["Safari-তে সাইটটি খুলুন।", "শেয়ার বোতাম চাপুন (তীর-ওয়ালা চারকোনা)।", "“Add to Home Screen”, তারপর “Add” চাপুন।", "নতুন আইকন থেকে খুলুন। অ্যাপের মতো পুরো পর্দায় খুলবে।"] },
  ],
  sizesTitle: "ছোট খামার বা বড় খামার",
  sizes: [
    "২–৩টি গরু: গরুগুলো যোগ করুন, চাইলে দিনে একবার দুধ লিখুন, আর টিকার তারিখ রাখুন। এর বেশি কিছু লাগবে না।",
    "বড় খামার: শেড যোগ করুন, প্রত্যেক কর্মীকে আলাদা লগইন দিন, আর হিসাবরক্ষকের জন্য রেকর্ড ডাউনলোড করুন।",
  ],
  stuckTitle: "আটকে গেছেন?",
  stuck: "পেছনের তীর চেপে ফিরে যান। কিছুই হারাবে না: যা সংরক্ষণ করেছেন তা থেকে যাবে। আপনার ডাক্তার বা পরিবারের কাউকে পাশে নিয়ে এই পাতাটি দেখান।",
  language: "উপরের বাংলা / English বোতাম চেপে যেকোনো সময় ভাষা বদলান।",
};

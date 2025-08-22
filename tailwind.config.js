/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // <--- เช็คว่ามีบรรทัดนี้ (สำคัญสำหรับปุ่ม Dark mode)
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <--- เช็คว่ามีบรรทัดนี้ เพื่อให้ Tailwind สแกนไฟล์ในโฟลเดอร์ src
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
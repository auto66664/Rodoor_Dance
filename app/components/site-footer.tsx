export default function SiteFooter() {
  return (
    <footer className="flex flex-col items-center gap-[15px] border-t border-[#1b2a3c] px-[5%] py-[25px] text-xs text-[#7f8ea0] md:flex-row md:justify-between md:gap-0 md:text-left">
      <div className="text-center md:text-left">
        <b className="text-[17px] text-white">
          ✦ รด. <span className="text-[#ffd22e]">แดนซ์</span>
        </b>
        <small className="mt-0.5 block text-[11px] text-[#91a0b2]">ฝึกให้ถูกต้อง พัฒนาให้ดีกว่า</small>
      </div>
      <div>หน้าหลัก　|　ฝึกท่า　|　สถิติ　|　เกี่ยวกับเรา</div>
      <div>© พัฒนาโดย Maythawin</div>
    </footer>
  );
}

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-gray-400 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm">
              投资研究平台 - 面向专业投资者的一站式量化投研工具
            </p>
          </div>
          <div className="flex space-x-6 text-sm">
            <span>数据来源: AKShare</span>
            <span>|</span>
            <span>Powered by Next.js + FastAPI</span>
          </div>
        </div>
        <div className="mt-4 text-center text-xs text-gray-500">
          免责声明：本平台仅供研究参考，不构成投资建议。投资有风险，决策需谨慎。
        </div>
      </div>
    </footer>
  )
}

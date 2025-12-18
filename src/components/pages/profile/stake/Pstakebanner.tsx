const PStakebanner = () => {
  return (
    <>
      <div className="m-auto flex max-sm:flex-col w-full justify-between gap-[10px] bg-white rounded-[18px] py-[32px] max-sm:gap-[30px]  px-[40px]  shadow-[0px_4px_24.2px_0px_rgba(0,60,82,0.10)]">
        <div className="flex flex-col items-center gap-[24px] max-sm:gap-[6px]">
          <p className="text-text_clr tracking-[0.54px] large">Total Pool Created</p>
          <h3 className="small text-black font-medium tracking-[1.08px] ">
            <span className="text-red">2</span>0
          </h3>
        </div>
        <div className="flex flex-col items-center gap-[24px] max-sm:gap-[6px]">
          <p className="text-text_clr tracking-[0.54px] large">Stake TVL</p>
          <h3 className="small text-black font-medium tracking-[1.08px] ">
            <span className="text-red">$</span>305,090
          </h3>
        </div>
        <div className="flex flex-col items-center gap-[24px] max-sm:gap-[6px]">
          <p className="text-text_clr tracking-[0.54px] large">My Stakes</p>
          <h3 className="small text-black font-medium tracking-[1.08px] ">
            <span className="text-red">$</span>254,090
          </h3>
        </div>
        <div className="flex flex-col items-center gap-[24px] max-sm:gap-[6px]">
          <p className="text-text_clr tracking-[0.54px] large">My Reward</p>
          <h3 className="small text-black font-medium tracking-[1.08px] ">
            <span className="text-red">$</span>124,000
          </h3>
        </div>
      </div>
    </>
  )
}

export default PStakebanner

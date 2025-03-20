function Dove({ width = 65, height = 65 }: { width?: number; height?: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 65 65"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M32.1658 0C14.4302 0 0 14.4302 0 32.1658C0 39.5119 2.54452 46.7059 7.16016 52.4036C7.45603 52.7671 7.98015 52.8178 8.34366 52.5304C8.70716 52.2345 8.75788 51.7104 8.47046 51.3469C4.09152 45.9451 1.68226 39.14 1.68226 32.1658C1.68226 15.3517 15.3601 1.6738 32.1742 1.6738C48.9883 1.6738 62.6662 15.3517 62.6662 32.1658C62.6662 48.9799 48.9883 62.6577 32.1742 62.6577C28.3448 62.6577 24.5998 61.9561 21.0663 60.5697C20.6351 60.4006 20.1448 60.612 19.9757 61.0431C19.8067 61.4742 20.018 61.9646 20.4491 62.1336C24.1856 63.5961 28.125 64.3315 32.1658 64.3315C49.9013 64.3315 64.3315 49.9013 64.3315 32.1658C64.34 14.4302 49.9098 0 32.1658 0Z"
        fill="white"
      />
      <path
        d="M16.7549 51.8034C18.4203 52.4797 20.297 52.9869 22.3174 53.325C18.2512 54.5085 14.7684 56.326 12.0379 58.1182C13.0438 55.8188 14.6247 53.7054 16.7549 51.8034ZM20.8634 48.1092C21.3199 48.4558 21.7848 48.7855 22.2751 49.0982C24.3631 50.4508 26.5949 51.4568 28.9027 52.0908C24.3885 52.1584 20.2547 51.4652 17.0593 50.1042C16.9832 50.0535 16.8987 50.0197 16.8141 49.9943C15.4193 49.3772 14.2104 48.6417 13.2383 47.771C15.5968 48.2529 18.285 48.3797 20.8634 48.1092ZM14.0498 35.2936C12.4774 29.4606 13.4581 23.205 16.7465 18.1244C17.2791 17.3044 18.0483 16.3238 18.7331 15.5207C18.6655 17.1945 18.7077 18.7246 18.8514 20.1195C18.8514 20.1702 18.8599 20.2209 18.8683 20.2632C19.5024 26.1637 21.8271 29.672 23.9574 31.6839C27.0683 34.6173 31.4219 35.8938 35.9107 35.1921C35.9192 35.1921 35.9276 35.1921 35.9361 35.1921C35.9445 35.1921 35.9445 35.1921 35.953 35.1921C38.8356 34.7526 41.7775 35.6571 44.229 37.7451C46.3086 39.5119 47.8387 41.955 48.515 44.5671C48.515 44.5756 48.5149 44.5925 48.5234 44.6009C48.5572 44.7193 48.5826 44.8376 48.6164 44.9644C48.6248 45.0067 48.6333 45.0574 48.6502 45.0997C48.6587 45.1335 48.6671 45.1673 48.6756 45.2011C46.4354 47.8556 43.1808 49.7492 39.4696 50.6283C39.4189 50.6283 39.3597 50.6368 39.309 50.6537C39.1653 50.6875 39.0216 50.7213 38.8779 50.7636C37.5253 51.0426 36.122 51.1863 34.6849 51.1863C30.6949 51.1863 26.7217 49.9774 23.1966 47.6865C22.6978 47.3653 22.2159 47.0187 21.7425 46.6552C21.6749 46.5875 21.6073 46.5284 21.5228 46.4861C17.8539 43.6119 15.2333 39.6979 14.0498 35.2936ZM32.9181 9.20592C31.5233 13.2467 29.8157 20.3139 32.301 25.9862C33.5353 28.7928 35.6486 30.9315 38.6074 32.3433C37.7282 32.9181 36.773 33.3493 35.6909 33.5437C35.6825 33.5437 35.674 33.5437 35.6655 33.5437C31.6924 34.1693 27.8545 33.0534 25.124 30.4751C23.2219 28.6829 21.1677 25.5551 20.5675 20.2378C23.5854 13.8976 29.8833 10.5162 32.9181 9.20592ZM44.2121 29.2747C46.4945 26.671 48.6587 24.2194 51.8287 24.2194C53.6378 24.2194 55.2017 25.6058 55.6582 26.7809C55.2609 26.933 54.779 27.2035 54.2972 27.6685C52.8178 29.114 52.0654 31.7262 52.0654 35.4288C52.0654 38.4383 51.3553 41.1265 49.9436 43.4344C49.0982 40.763 47.4752 38.2946 45.3195 36.4602C43.6034 34.9977 41.6676 34.0509 39.6641 33.6367C41.3971 32.4785 42.8173 30.8555 44.2121 29.2747ZM39.3006 52.3951C43.7049 51.4652 47.5851 49.2335 50.1718 46.0296C50.1888 46.0127 50.2141 45.9873 50.231 45.962C52.5642 43.0455 53.7477 39.495 53.7477 35.4288C53.7477 31.6586 54.5761 29.9002 55.2778 29.0802C55.9118 28.3363 56.5289 28.2602 56.6219 28.2602C56.8502 28.2687 57.053 28.1926 57.2221 28.0404C57.3912 27.8798 57.4673 27.66 57.4673 27.4233C57.4673 25.2254 54.8636 22.5456 51.8287 22.5456C47.8978 22.5456 45.3787 25.4029 42.9525 28.1757C42.0142 29.2493 41.0927 30.2891 40.1121 31.1767C37.1196 29.9425 35.0146 27.9813 33.848 25.3184C31.1936 19.2656 33.8734 11.2432 35.1499 8.07314C35.2682 7.76881 35.2091 7.42222 34.9808 7.18552C34.761 6.94882 34.4144 6.85583 34.1101 6.95727C33.1126 7.27851 25.0479 10.0682 20.3984 17.1438C20.3984 15.9857 20.4492 14.743 20.5844 13.4073C20.6182 13.0776 20.4576 12.7649 20.1786 12.6042C19.8997 12.4352 19.5446 12.4521 19.2741 12.6381C18.4541 13.2044 16.3999 15.6053 15.3517 17.2368C11.7927 22.6893 10.736 29.4437 12.4267 35.7332C13.5426 39.8754 15.8335 43.6034 19.0036 46.5537C16.1547 46.6552 13.3228 46.2663 11.1249 45.4548C10.7867 45.328 10.4148 45.4294 10.1865 45.7084C9.95829 45.9873 9.93293 46.3762 10.1189 46.6805C11.201 48.4473 12.917 49.9098 15.0981 51.0426C12.2999 53.697 10.4486 56.7318 9.57788 60.0794C9.48489 60.426 9.6286 60.7895 9.92448 60.9839C10.0682 61.0769 10.2288 61.1276 10.3894 61.1276C10.5669 61.1276 10.7445 61.0685 10.8882 60.9586C14.836 58.0083 21.2015 54.3733 29.1056 53.773C32.3771 53.7139 35.8346 53.2658 39.3006 52.3951Z"
        fill="white"
      />
    </svg>
  );
}

export default Dove;

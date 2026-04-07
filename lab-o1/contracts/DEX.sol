// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title DEX – fixed-rate exchange with invariant x + r·y = k
contract DEX {
    address public immutable tokenA;
    address public immutable tokenB;
    uint256 public immutable rate;
    address private immutable _feeRecipient;

    uint256 public reserveA;
    uint256 public reserveB;
    uint256 public pendingFeeA;
    uint256 public pendingFeeB;

    constructor(address _tokenA, address _tokenB, uint256 _rate, address feeRecip) {
        require(_tokenA != address(0) && _tokenB != address(0), "Zero addr");
        require(_tokenA != _tokenB, "Same token");
        require(_rate > 0, "Zero rate");
        tokenA = _tokenA;
        tokenB = _tokenB;
        rate = _rate;
        _feeRecipient = feeRecip;
    }

    function addLiquidity(uint256 amountA, uint256 amountB) external {
        if (amountA > 0) {
            IERC20(tokenA).transferFrom(msg.sender, address(this), amountA);
            reserveA += amountA;
        }
        if (amountB > 0) {
            IERC20(tokenB).transferFrom(msg.sender, address(this), amountB);
            reserveB += amountB;
        }
    }

    function swap(address tokenIn, uint256 amountIn) external {
        require(tokenIn == tokenA || tokenIn == tokenB, "Invalid token");
        require(amountIn > 0, "Zero amount");

        uint256 fee;
        uint256 net;
        if (_feeRecipient != address(0)) {
            fee = amountIn / 1000;
            net = amountIn - fee;
        } else {
            net = amountIn;
        }

        if (tokenIn == tokenA) {
            uint256 out = net / rate;
            require(out > 0 && reserveB >= out, "Insufficient");
            IERC20(tokenA).transferFrom(msg.sender, address(this), amountIn);
            IERC20(tokenB).transfer(msg.sender, out);
            reserveA += net;
            reserveB -= out;
            if (fee > 0) pendingFeeA += fee;
        } else {
            uint256 out = net * rate;
            require(reserveA >= out, "Insufficient");
            IERC20(tokenB).transferFrom(msg.sender, address(this), amountIn);
            IERC20(tokenA).transfer(msg.sender, out);
            reserveB += net;
            reserveA -= out;
            if (fee > 0) pendingFeeB += fee;
        }
    }

    function getReserves() external view returns (uint256, uint256) {
        return (reserveA, reserveB);
    }

    function feeRecipient() external view returns (address) {
        return _feeRecipient;
    }

    function withdrawFee() external {
        uint256 fA = pendingFeeA;
        uint256 fB = pendingFeeB;
        pendingFeeA = 0;
        pendingFeeB = 0;
        if (fA > 0) IERC20(tokenA).transfer(_feeRecipient, fA);
        if (fB > 0) IERC20(tokenB).transfer(_feeRecipient, fB);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TokenTrade is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;

    uint256 public tradeCounter;
    uint256 public constant FEE_PERCENTAGE = 10; // 0.1% = 10 basis points (10/10000)
    uint256 public constant FEE_DENOMINATOR = 10000;

    struct Trade {
        address seller;
        address inputToken;
        uint256 inputAmount;
        uint256 outputAmount;
        uint256 expiry;
        bool settled;
    }

    mapping(uint256 => Trade) public trades;
    mapping(address => uint256) public accumulatedFees;

    event TradeCreated(
        uint256 indexed tradeId,
        address indexed seller,
        address inputToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 expiry
    );

    event TradeSettled(
        uint256 indexed tradeId,
        address indexed seller,
        address indexed buyer,
        address inputToken,
        uint256 inputAmount,
        uint256 outputAmount,
        uint256 fee
    );

    event FeeWithdrawn(address indexed owner, address indexed token, uint256 amount);

    error InvalidToken();
    error InvalidAmount();
    error InvalidExpiry();
    error TradeNotFound();
    error TradeExpired();
    error TradeAlreadySettled();
    error TradeNotExpired();

    constructor(address _tokenA, address _tokenB) Ownable(msg.sender) {
        require(_tokenA != address(0) && _tokenB != address(0), "Invalid token address");
        require(_tokenA != _tokenB, "Tokens must be different");
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    function setupTrade(
        address inputTokenForSale,
        uint256 inputTokenAmount,
        uint256 outputTokenAsk,
        uint256 expiry
    ) external returns (uint256) {
        if (inputTokenForSale != address(tokenA) && inputTokenForSale != address(tokenB)) {
            revert InvalidToken();
        }
        if (inputTokenAmount == 0 || outputTokenAsk == 0) {
            revert InvalidAmount();
        }
        if (expiry <= block.timestamp) {
            revert InvalidExpiry();
        }

        uint256 tradeId = tradeCounter++;

        trades[tradeId] = Trade({
            seller: msg.sender,
            inputToken: inputTokenForSale,
            inputAmount: inputTokenAmount,
            outputAmount: outputTokenAsk,
            expiry: expiry,
            settled: false
        });

        // Transfer the input tokens from seller to contract
        IERC20(inputTokenForSale).safeTransferFrom(msg.sender, address(this), inputTokenAmount);

        emit TradeCreated(
            tradeId,
            msg.sender,
            inputTokenForSale,
            inputTokenAmount,
            outputTokenAsk,
            expiry
        );

        return tradeId;
    }

    function settleTrade(uint256 id) external {
        Trade storage trade = trades[id];

        if (trade.seller == address(0)) {
            revert TradeNotFound();
        }
        if (trade.settled) {
            revert TradeAlreadySettled();
        }
        if (block.timestamp > trade.expiry) {
            revert TradeExpired();
        }

        trade.settled = true;

        // Determine output token (the other token)
        address outputToken = trade.inputToken == address(tokenA) ? address(tokenB) : address(tokenA);

        // Calculate fee (0.1% of the sale/input amount)
        uint256 fee = (trade.inputAmount * FEE_PERCENTAGE) / FEE_DENOMINATOR;
        uint256 amountAfterFee = trade.inputAmount - fee;

        // Accumulate fee for the input token
        accumulatedFees[trade.inputToken] += fee;

        // Transfer output tokens from buyer to seller
        IERC20(outputToken).safeTransferFrom(msg.sender, trade.seller, trade.outputAmount);

        // Transfer input tokens (minus fee) from contract to buyer
        IERC20(trade.inputToken).safeTransfer(msg.sender, amountAfterFee);

        emit TradeSettled(
            id,
            trade.seller,
            msg.sender,
            trade.inputToken,
            trade.inputAmount,
            trade.outputAmount,
            fee
        );
    }

    function cancelExpiredTrade(uint256 id) external {
        Trade storage trade = trades[id];

        if (trade.seller == address(0)) {
            revert TradeNotFound();
        }
        if (trade.settled) {
            revert TradeAlreadySettled();
        }
        if (block.timestamp <= trade.expiry) {
            revert TradeNotExpired();
        }

        trade.settled = true;

        // Return tokens to seller
        IERC20(trade.inputToken).safeTransfer(trade.seller, trade.inputAmount);
    }

    function withdrawFee() external onlyOwner {
        uint256 feeA = accumulatedFees[address(tokenA)];
        uint256 feeB = accumulatedFees[address(tokenB)];

        if (feeA > 0) {
            accumulatedFees[address(tokenA)] = 0;
            tokenA.safeTransfer(owner(), feeA);
            emit FeeWithdrawn(owner(), address(tokenA), feeA);
        }

        if (feeB > 0) {
            accumulatedFees[address(tokenB)] = 0;
            tokenB.safeTransfer(owner(), feeB);
            emit FeeWithdrawn(owner(), address(tokenB), feeB);
        }
    }

    function getTrade(uint256 id) external view returns (Trade memory) {
        return trades[id];
    }
}

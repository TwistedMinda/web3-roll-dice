import { Game } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";
import { ethers, network, run } from "hardhat";
import {
    VERIFICATION_BLOCK_CONFIRMATIONS,
    networkConfig,
    developmentChains,
} from "./networks.config"
import { BigNumber } from "ethers";
import { expect } from "chai";

type CurrentRound = Awaited<ReturnType<Game['currentRound']>>
type LastRound = Awaited<ReturnType<Game['lastRound']>>
type Stats = Awaited<ReturnType<Game['stats']>>
type PlayerState = Awaited<ReturnType<Game['players']>>

type Info = {
	current: CurrentRound,
	last: LastRound,
	stats: Stats,
}
type GetInfoCallback = (info: Info) => Promise<any> | any
type GetPlayerCallback = (player: PlayerState) => Promise<any> | any

export const ROUND_DURATION = 5 * 60
export const GAME_PRICE = parseEther("0.001")

export const getInfo = async (game: Game, callback: GetInfoCallback) => callback({
	current: await game.currentRound(),
	last: await game.lastRound(),
	stats: await game.stats(),
})

export const getPlayer = async (address: string, game: Game, callback: GetPlayerCallback) => callback(await game.players(address))

export const playForWin = async (account: SignerWithAddress, game: Game, coordinator: any) => {
	return expectPlayResult(6, 6, account, game, coordinator)
}

export const playForLoss = async (account: SignerWithAddress, game: Game, coordinator: any) => {
	return expectPlayResult(5, 6, account, game, coordinator)
}

const expectPlayResult = async (
	bet: number,
	result: number,
	account: SignerWithAddress,
	game: Game,
	coordinator: any) => {
	console.log(bet, result)
	let rollId: BigNumber = BigNumber.from("0")
	const captureRollId = (value: any) => {
		rollId = value
		return true
	}
	const captureBet = (value: any) => {
		console.log('bet', value)
		return true
	}
	const captureRes = (value: any) => {
		console.log('Res', value)
		return true
	}
	const win = bet == result
	await expect(play(bet, game, account)).to.emit(game, 'RollStarted').withArgs(captureRollId)
	await expect(coordinator.fulfillRandomWords(
		rollId,
		game.address,
	)).to.emit(game, "GameEnded").withArgs(account.address, win, captureBet, captureRes)
}

export const play = async (
	bet: number,
	game: Game,
	account: SignerWithAddress,
	amount = GAME_PRICE
) => game.connect(account).play(bet, {
	from: account.address,
	value: amount,
});

export const claim = (game: Game, account: SignerWithAddress) => game.connect(account).claim({
	from: account.address,
});

export const deploy = async () => {
	const [owner, otherAccount] = await ethers.getSigners();

	const chainId = 31337
	const network = networkConfig['default']

	// Create fake Chainlink Coordinatoor
	const BASE_FEE = "1000000"
	const GAS_PRICE_LINK = "10000000" // 0.000000001 LINK per gas
	const VRFCoordinatorV2MockFactory = await ethers.getContractFactory("VRFCoordinatorV2Mock")
	const VRFCoordinatorV2Mock = await VRFCoordinatorV2MockFactory.deploy(BASE_FEE, GAS_PRICE_LINK)
	const vrfCoordinatorAddress = VRFCoordinatorV2Mock.address

	// Create fake subscription
	const fundAmount = "10000000000000000000000"
	const transaction = await VRFCoordinatorV2Mock.createSubscription()
	const transactionReceipt = await transaction.wait(1)
	const topic = transactionReceipt.events
		? transactionReceipt.events[0].topics[1]
		: '0'
	const subscriptionId = ethers.BigNumber.from(topic)
	await VRFCoordinatorV2Mock.fundSubscription(subscriptionId, fundAmount)

	// Initialize contract
    const keyHash = network["keyHash"]
	const Game = await ethers.getContractFactory("Game");
	const game = await Game.deploy(
		subscriptionId,
        vrfCoordinatorAddress,
        keyHash,
	);

	// Wait full deployment
    await game.deployTransaction.wait(1)

	// Add consumer
	await VRFCoordinatorV2Mock.addConsumer(subscriptionId, game.address)

	return { game, VRFCoordinatorV2Mock, owner, otherAccount };
}

export const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration))

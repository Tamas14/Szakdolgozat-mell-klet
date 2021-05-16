package KO8L9F;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.net.URL;
import java.nio.channels.Channels;
import java.nio.channels.ReadableByteChannel;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Scanner;

public class Main {

	static List<Long> timestamps = new ArrayList<Long>();

	public static void main(String[] args) {
		File dlDir = new File("TMP\\");
		File moveDir = new File("stocks\\");

		dlDir.mkdir();
		moveDir.mkdir();

		Scanner s = new Scanner(System.in);
		System.out.print("Ticker: ");
		String symbol = s.nextLine();
		s.close();
		
		symbol = symbol.toUpperCase();
		
		download(symbol, dlDir);
		concat(dlDir);
		
		try {
			move(dlDir, moveDir, symbol);
		} catch (IOException e) {
			e.printStackTrace();
		}

		dlDir.delete();
	}

	static int counter = 0;

	public static void download(String symbol, File dlDir) {
		try {
			outer: for (int i = 1; i <= 2; i++)
				for (int j = 1; j <= 12; j++) {

					if (!(timestamps.size() < 5)) {
						System.out.println("Waiting");
						while ((timestamps.get(0) + 61000L) >= System.currentTimeMillis()) {
							Thread.sleep(1000);
						}

						Collections.rotate(timestamps, -1);
						timestamps.remove(timestamps.size() - 1);
					}

					String date = "year" + i + "month" + j;
					System.out.println("Downloading " + symbol + "-" + date);

					String url = "https://www.alphavantage.co/query?function=TIME_SERIES_INTRADAY_EXTENDED&symbol="
							+ symbol + "&interval=1min&slice=" + date + "&apikey=E4171WVX1DM0XQZJ";
					URL website = new URL(url);
					ReadableByteChannel rbc = Channels.newChannel(website.openStream());
					FileOutputStream fos = new FileOutputStream(
							dlDir.getAbsolutePath() + "\\" + symbol + "-" + date + ".csv");
					fos.getChannel().transferFrom(rbc, 0, Long.MAX_VALUE);

					BufferedReader br = new BufferedReader(
							new FileReader(new File(dlDir.getAbsolutePath() + "\\" + symbol + "-" + date + ".csv")));

					String line = "";
					int linecount = 0;
					while ((line = br.readLine()) != null) {
						if (line.contains("API call frequency")) {
							int index = 12 * (i - 1) + j;
							new File(dlDir.getAbsolutePath() + "\\" + symbol + "-" + date + ".csv").delete();
							if (index == 13) {
								i--;
								j = 12;
							}

							if (index != 13)
								j--;

							for (int k = 0; k <= 5 - timestamps.size(); k++) {
								timestamps.add(System.currentTimeMillis());
							}

							continue;
						}
						linecount++;
					}

					br.close();
					fos.close();
					rbc.close();

					if (linecount == 1) {
						new File(dlDir.getAbsolutePath() + "\\" + symbol + "-" + date + ".csv").delete();
						System.out.println("No data found");
						break outer;
					}

					if (timestamps.size() < 5) {
						timestamps.add(System.currentTimeMillis());
					}
				}
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

	public static void concat(File moveDir) {
		int count = 0;
		File[] files = moveDir.listFiles();

		if (files.length == 0) {
			System.out.println("File not found in TMP folder, probably invalid ticker is given.");
			System.exit(-1);
		}

		String filename = files[0].getName();
		String symbol = filename.substring(0, filename.indexOf("-"));

		try {
			PrintWriter pw = new PrintWriter(
					new FileOutputStream(new File(moveDir.getAbsolutePath() + "\\" + symbol + ".csv")), false);
			BufferedReader br = null;
			String line;

			pw.println("Date,Open,High,Low,Close,Volume");

			for (int i = 1; i <= 2; i++)
				for (int j = 1; j <= 12; j++) {
					String date = "year" + i + "month" + j;

					System.out.println("Writing " + date);

					try {
						br = new BufferedReader(new FileReader(
								new File(moveDir.getAbsolutePath() + "\\" + symbol + "-" + date + ".csv")));

						while ((line = br.readLine()) != null) {
							if (line.equalsIgnoreCase("time,open,high,low,close,volume")) {
								continue;
							}

							count++;
							pw.println(line);
						}

						br.close();
					} catch (Exception e) {
						System.out.println("Not found");
						continue;
					}
				}

			pw.close();
		} catch (Exception e) {
		}

		System.out.println("Total " + count + " lines were written");
	}

	public static void move(File from, File to, String symbol) throws IOException {
		new File(to.getAbsolutePath() + "\\" + symbol).mkdir();
		Files.move(Paths.get(from.getAbsolutePath() + "\\" + symbol + ".csv"),
				Paths.get(to.getAbsolutePath() + "\\" + symbol + "\\" + symbol + ".csv"),
				StandardCopyOption.REPLACE_EXISTING);

		for (File f : from.listFiles()) {
			Files.deleteIfExists(Paths.get(f.getAbsolutePath()));
		}
	}

}

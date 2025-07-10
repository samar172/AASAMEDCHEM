import java.util.Scanner;
import java.util.Stack;

public class BalancedParenthesesChecker {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter an expression: ");
        String expression = scanner.nextLine();
        checkBalancedParentheses(expression);
        scanner.close();
    }

    public static void checkBalancedParentheses(String expr) {
        Stack<Character> stack = new Stack<>();
        Stack<Integer> positionStack = new Stack<>();
        for (int i = 0; i < expr.length(); i++) {
            char ch = expr.charAt(i);
            if (ch == '(' || ch == '[' || ch == '{') {
                stack.push(ch);
                positionStack.push(i);
            } else if (ch == ')' || ch == ']' || ch == '}') {
                if (stack.isEmpty()) {
                    System.out.println("Unbalanced at position " + i + ": unexpected '" + ch + "'");
                    return;
                }
                char top = stack.pop();
                int pos = positionStack.pop();
                if (!isMatchingPair(top, ch)) {
                    System.out.println("Unbalanced at position " + i + ": expected '" + getExpectedClosing(top) + "' but found '" + ch + "'");
                    return;
                }
            }
        }
        if (!stack.isEmpty()) {
            int pos = positionStack.pop();
            char unclosed = stack.pop();
            System.out.println("Unbalanced at position " + pos + ": missing closing '" + getExpectedClosing(unclosed) + "'");
        } else {
            System.out.println("The expression is balanced.");
        }
    }

    private static boolean isMatchingPair(char open, char close) {
        return (open == '(' && close == ')') ||
               (open == '[' && close == ']') ||
               (open == '{' && close == '}');
    }

    private static char getExpectedClosing(char open) {
        switch (open) {
            case '(': return ')';
            case '[': return ']';
            case '{': return '}';
            default: return '?';
        }
    }
} 
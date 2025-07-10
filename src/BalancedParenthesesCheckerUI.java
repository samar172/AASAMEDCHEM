import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
import java.util.Stack;

public class BalancedParenthesesCheckerUI extends JFrame {
    private JTextField inputField;
    private JButton checkButton;
    private JLabel resultLabel;

    public BalancedParenthesesCheckerUI() {
        setTitle("Balanced Parentheses Checker");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(400, 150);
        setLocationRelativeTo(null);
        setLayout(new BorderLayout(10, 10));

        JPanel inputPanel = new JPanel(new BorderLayout(5, 5));
        inputPanel.add(new JLabel("Enter expression: "), BorderLayout.WEST);
        inputField = new JTextField();
        inputPanel.add(inputField, BorderLayout.CENTER);
        add(inputPanel, BorderLayout.NORTH);

        checkButton = new JButton("Check");
        add(checkButton, BorderLayout.CENTER);

        resultLabel = new JLabel(" ", SwingConstants.CENTER);
        add(resultLabel, BorderLayout.SOUTH);

        checkButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                String expr = inputField.getText();
                String result = checkBalancedParentheses(expr);
                resultLabel.setText(result);
            }
        });
    }

    public static String checkBalancedParentheses(String expr) {
        Stack<Character> stack = new Stack<>();
        Stack<Integer> positionStack = new Stack<>();
        for (int i = 0; i < expr.length(); i++) {
            char ch = expr.charAt(i);
            if (ch == '(' || ch == '[' || ch == '{') {
                stack.push(ch);
                positionStack.push(i);
            } else if (ch == ')' || ch == ']' || ch == '}') {
                if (stack.isEmpty()) {
                    return "Unbalanced at position " + i + ": unexpected '" + ch + "'";
                }
                char top = stack.pop();
                int pos = positionStack.pop();
                if (!isMatchingPair(top, ch)) {
                    return "Unbalanced at position " + i + ": expected '" + getExpectedClosing(top) + "' but found '" + ch + "'";
                }
            }
        }
        if (!stack.isEmpty()) {
            int pos = positionStack.pop();
            char unclosed = stack.pop();
            return "Unbalanced at position " + pos + ": missing closing '" + getExpectedClosing(unclosed) + "'";
        } else {
            return "The expression is balanced.";
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

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            new BalancedParenthesesCheckerUI().setVisible(true);
        });
    }
} 
import javax.swing.*;
import java.awt.*;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.time.Year;


public class Main extends JFrame {

    private static final Map<String, String> credentials = new HashMap<>();
    private static final Map<String, String> names       = new HashMap<>();
    private static final List<String>        registeredIds = new ArrayList<>();

    private final CardLayout cardLayout = new CardLayout();
    private final JPanel     container  = new JPanel(cardLayout);

    private JTextField    regNameField, loginIdField;
    private JPasswordField regPassField, loginPassField;
    private JLabel        messageLabel;

    public Main() {
        setTitle("CourseSim – Register / Login");
        setSize(520, 460);
        setLocationRelativeTo(null);
        setDefaultCloseOperation(EXIT_ON_CLOSE);
        getContentPane().setBackground(new Color(10, 15, 26));

        messageLabel = new JLabel(" ");
        messageLabel.setForeground(new Color(147, 197, 253));
        messageLabel.setHorizontalAlignment(SwingConstants.CENTER);

        container.add(buildLoginPanel(),    "login");
        container.add(buildRegisterPanel(), "register");
        add(container);

        cardLayout.show(container, "login");
    }

    private JPanel buildLoginPanel() {
        JPanel panel = new JPanel(new GridBagLayout());
        panel.setBackground(new Color(10, 15, 26));
        GridBagConstraints c = gbc();

        JLabel title = heading("Login");

        loginIdField   = new JTextField(20);
        loginPassField = new JPasswordField(20);
        JButton loginBtn    = btn("Login");
        JButton goRegister  = btn("Go to Register");

        loginBtn.addActionListener(e -> doLogin());
        goRegister.addActionListener(e -> {
            clearMessage();
            cardLayout.show(container, "register");
        });

        c.gridx = 0; c.gridy = 0;
        panel.add(title, c);           c.gridy++;
        panel.add(lbl("Student ID"),   c); c.gridy++;
        panel.add(loginIdField,        c); c.gridy++;
        panel.add(lbl("Password"),     c); c.gridy++;
        panel.add(loginPassField,      c); c.gridy++;
        panel.add(loginBtn,            c); c.gridy++;
        panel.add(goRegister,          c); c.gridy++;
        panel.add(messageLabel,        c);

        return panel;
    }

    private JPanel buildRegisterPanel() {
        JPanel panel = new JPanel(new GridBagLayout());
        panel.setBackground(new Color(10, 15, 26));
        GridBagConstraints c = gbc();

        JLabel title = heading("Create Account");

        regNameField = new JTextField(20);
        regPassField = new JPasswordField(20);
        JButton regBtn  = btn("Create Account");
        JButton backBtn = btn("Back to Login");

        regBtn.addActionListener(e  -> doRegister());
        backBtn.addActionListener(e -> {
            clearMessage();
            cardLayout.show(container, "login");
        });

        c.gridx = 0; c.gridy = 0;
        panel.add(title,                               c); c.gridy++;
        panel.add(lbl("Full Name"),                    c); c.gridy++;
        panel.add(regNameField,                        c); c.gridy++;
        panel.add(lbl("Password (min. 6 characters)"), c); c.gridy++;
        panel.add(regPassField,                        c); c.gridy++;
        panel.add(lbl("Your ID will be auto-generated"), c); c.gridy++;
        panel.add(regBtn,                              c); c.gridy++;
        panel.add(backBtn,                             c); c.gridy++;
        panel.add(messageLabel,                        c);

        return panel;
    }

    /* ── Actions ──────────────────────────────────────── */

    private void doRegister() {
        String name = regNameField.getText().trim();
        String pass = new String(regPassField.getPassword()).trim();

        if (name.isEmpty() || pass.isEmpty()) {
            setMsg("Please fill in all fields.", false);
            return;
        }
        if (pass.length() < 6) {
            setMsg("Password must be at least 6 characters.", false);
            return;
        }

        String id = generateId();
        credentials.put(id, pass);
        names.put(id, name);
        registeredIds.add(id);

        setMsg("Registered! Your ID is: " + id, true);
        JOptionPane.showMessageDialog(
            this,
            "<html><b>Account created for " + name + "!</b><br><br>" +
            "Your Student ID is: <b>" + id + "</b><br>" +
            "<small>Please save this ID — you will need it to log in.</small></html>",
            "Registration Successful",
            JOptionPane.INFORMATION_MESSAGE
        );

        regNameField.setText("");
        regPassField.setText("");
        cardLayout.show(container, "login");
    }

    private void doLogin() {
        String id   = loginIdField.getText().trim();
        String pass = new String(loginPassField.getPassword()).trim();

        if (credentials.containsKey(id) && credentials.get(id).equals(pass)) {
            String name = names.getOrDefault(id, "Student");
            setMsg("Welcome, " + name + "!", true);
            JOptionPane.showMessageDialog(
                this,
                "Welcome back, " + name + "!\nLogin successful.",
                "Login Success",
                JOptionPane.INFORMATION_MESSAGE
            );
        } else {
            setMsg("Invalid ID or password. Please try again.", false);
        }
    }

    private String generateId() {
        int    year   = Year.now().getValue();
        int    seq    = registeredIds.size() + 1;
        String seqStr = String.format("%04d", seq);
        char   letter = (char) ('A' + (int)(Math.random() * 26));
        return year + "-" + seqStr + "-" + letter;
    }

    private void setMsg(String text, boolean success) {
        messageLabel.setText(text);
        messageLabel.setForeground(
            success ? new Color(134, 239, 172) : new Color(252, 165, 165)
        );
    }

    private void clearMessage() {
        messageLabel.setText(" ");
    }

    private JLabel heading(String text) {
        JLabel l = new JLabel(text);
        l.setForeground(Color.WHITE);
        l.setFont(new Font("Arial", Font.BOLD, 22));
        return l;
    }

    private JLabel lbl(String text) {
        JLabel l = new JLabel(text);
        l.setForeground(new Color(203, 213, 225));
        return l;
    }

    private JButton btn(String text) {
        JButton b = new JButton(text);
        b.setBackground(new Color(37, 99, 235));
        b.setForeground(Color.WHITE);
        b.setFocusPainted(false);
        return b;
    }

    private GridBagConstraints gbc() {
        GridBagConstraints c = new GridBagConstraints();
        c.insets    = new Insets(7, 10, 7, 10);
        c.fill      = GridBagConstraints.HORIZONTAL;
        c.gridwidth = 2;
        return c;
    }


    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> new Main().setVisible(true));
    }
}
